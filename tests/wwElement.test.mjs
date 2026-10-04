// =============================================================================
// wwElement.test.mjs — Ergebnistabelle haengt am Berechneten (trinkgeld)
//
// Laeuft mit dem eingebauten Node-Test-Runner, OHNE neue Abhaengigkeiten:
//   npm test        (bzw. node --test tests/wwElement.test.mjs)
//
// Der <script>-Block des SFC wird ausgeschnitten, als ESM-Modul geladen und die
// Optionen (computed/methods) mit einem Fake-`this` geprueft.
// =============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sfc = readFileSync(join(here, "..", "src", "wwElement.vue"), "utf8");

const scriptStart = sfc.indexOf("<script>");
const scriptEnd = sfc.indexOf("\n</script>");
assert.ok(scriptStart > -1 && scriptEnd > scriptStart, "Script-Block im SFC nicht gefunden");
const scriptSrc = sfc.slice(scriptStart + "<script>".length, scriptEnd);

const dir = mkdtempSync(join(tmpdir(), "tgv-test-"));
const modPath = join(dir, "wwElement.options.mjs");
writeFileSync(modPath, scriptSrc, "utf8");
const options = (await import(pathToFileURL(modPath).href)).default;

function makeVm() {
  const vm = {
    ...options.data(),
    content: { authToken: "jwt-123", apiKey: "anon-key", supabaseUrl: "https://db.example.co" },
    uid: "test",
    emitted: [],
    $emit(name, payload) { this.emitted.push({ name, payload }); },
  };
  for (const [name, fn] of Object.entries(options.computed)) {
    Object.defineProperty(vm, name, { get: () => fn.call(vm), configurable: true });
  }
  for (const [name, fn] of Object.entries(options.methods)) {
    vm[name] = fn.bind(vm);
  }
  return vm;
}

const jsonRes = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

/** Berechnet mit gefaelschter Antwort: zwei Mitarbeitende, Basis 5 und 3. */
async function berechneMit({ yearMonth, betrag, methode }) {
  const vm = makeVm();
  vm.yearMonth = yearMonth;
  vm.betrag = betrag;
  vm.methode = methode;
  globalThis.fetch = async (url) => {
    if (String(url).includes("trinkgeld_verteilung")) {
      return jsonRes([
        { employee_id: "e1", basis: 5, anteil_chf: 62.5 },
        { employee_id: "e2", basis: 3, anteil_chf: 37.5 },
      ]);
    }
    return jsonRes([]);
  };
  await vm.berechnen();
  return vm;
}

test("Methodenwechsel nach dem Berechnen: Tage bleiben Tage, Kopf und Methode bleiben", async () => {
  const vm = await berechneMit({ yearMonth: "2026-08", betrag: 100, methode: "tage" });
  assert.equal(vm.zeilen.length, 2);
  vm.methode = "stunden";
  assert.equal(vm.result.methode, "tage");
  assert.equal(vm.formatBasis(5), "5", "5 Tage duerfen nicht als «5:00» erscheinen");
  assert.equal(vm.formatBasis(vm.totalBasis), "8");
});

test("Umgekehrt: Stunden bleiben Stunden, wenn danach auf Tage gewechselt wird", async () => {
  const vm = await berechneMit({ yearMonth: "2026-08", betrag: 100, methode: "stunden" });
  vm.methode = "tage";
  assert.equal(vm.formatBasis(7.5), "7:30");
});

test("Monat und Betrag nach dem Berechnen: Ergebnis behaelt die berechneten Werte", async () => {
  const vm = await berechneMit({ yearMonth: "2026-08", betrag: 100, methode: "tage" });
  vm.yearMonth = "2026-09";
  vm.betrag = 999;
  assert.deepEqual({ ...vm.result }, { yearMonth: "2026-08", betrag: 100, methode: "tage" });
  // Rundungshinweis der Tabelle rechnet gegen den berechneten Betrag (100), nicht gegen 999.
  assert.equal(Math.abs(vm.totalAusgezahlt - vm.result.betrag) < 0.01, true);
});

test("Neues Berechnen setzt das Ergebnis auf die neuen Eingaben", async () => {
  const vm = await berechneMit({ yearMonth: "2026-08", betrag: 100, methode: "tage" });
  vm.yearMonth = "2026-07";
  vm.betrag = 80;
  vm.methode = "stunden";
  await vm.berechnen();
  assert.deepEqual({ ...vm.result }, { yearMonth: "2026-07", betrag: 80, methode: "stunden" });
  assert.equal(vm.formatBasis(7.5), "7:30");
});

test("Die Ergebnistabelle liest nicht die Live-Eingaben", () => {
  const start = sfc.indexOf('<section v-if="!loading');
  const end = sfc.indexOf("</template>\n    </main>");
  assert.ok(start > -1 && end > start, "Ergebnisbereich nicht gefunden");
  const ergebnis = sfc.slice(start, end);
  assert.doesNotMatch(ergebnis, /formatMonat\(yearMonth\)/);
  assert.doesNotMatch(ergebnis, /formatChf\(betrag\)/);
  assert.doesNotMatch(ergebnis, /(?<!\.)\bmethode === /);
  assert.doesNotMatch(ergebnis, /totalAusgezahlt - (?<!\.)\bbetrag\b/);
  assert.doesNotMatch(ergebnis, /(?<!\.)\bbetrag - totalAusgezahlt/);
});
