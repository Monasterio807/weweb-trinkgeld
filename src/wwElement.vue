<template>
  <div class="hrk-root">
    <main class="hrk-page">
      <!-- Kopf -->
      <header class="tgv-head">
        <h1 class="hrk-h1">Trinkgeld-Verteilung</h1>
        <p class="hrk-muted">Gib den Gesamtbetrag und den Monat ein — wir verteilen proportional nach geleisteten Stunden oder Tagen (aus der Zeiterfassung).</p>
      </header>

      <!-- Nicht eingeloggt -->
      <div v-if="!hasConfig" class="hrk-state">
        <p class="hrk-state__title">Kein Zugang konfiguriert</p>
        <p class="hrk-muted">Bitte authToken und apiKey in den Komponenten-Einstellungen hinterlegen.</p>
      </div>

      <template v-else>
        <!-- Formular -->
        <section class="hrk-card tgv-form-card">
          <div class="tgv-form-grid">
            <!-- Monat -->
            <div class="hrk-field">
              <label class="hrk-label" :for="fid('monat')">Monat</label>
              <input :id="fid('monat')" v-model="yearMonth" type="month" class="hrk-input" :max="currentYearMonth" />
            </div>
            <!-- Betrag -->
            <div class="hrk-field">
              <label class="hrk-label" :for="fid('betrag')">Gesamtbetrag (CHF)</label>
              <input :id="fid('betrag')" v-model.number="betrag" type="number" min="0.01" step="0.01" class="hrk-input" placeholder="z. B. 250.00" />
            </div>
          </div>

          <!-- Methode -->
          <div class="hrk-field">
            <p class="hrk-label" style="margin-bottom:var(--hrk-space-2)">Verteilungsmethode</p>
            <div class="tgv-methode">
              <label class="hrk-radio" :class="methode === 'tage' ? 'hrk-radio--selected' : ''">
                <input v-model="methode" type="radio" value="tage" />
                <span class="hrk-radio__body">
                  <span class="hrk-radio__title">Nach Arbeitstagen</span>
                  <span class="hrk-radio__hint">Anzahl Tage mit Zeiterfassung im Monat — einfach und gerecht.</span>
                </span>
              </label>
              <label class="hrk-radio" :class="methode === 'stunden' ? 'hrk-radio--selected' : ''">
                <input v-model="methode" type="radio" value="stunden" />
                <span class="hrk-radio__body">
                  <span class="hrk-radio__title">Nach Arbeitsstunden</span>
                  <span class="hrk-radio__hint">Genauere Verteilung bei stark unterschiedlichen Teilzeitpensen.</span>
                </span>
              </label>
            </div>
          </div>

          <div class="hrk-actions">
            <button type="button" class="hrk-btn hrk-btn--primary" :disabled="!canCalc || loading" @click="berechnen">
              {{ loading ? 'Wird berechnet …' : 'Berechnen' }}
            </button>
            <button v-if="zeilen.length" type="button" class="hrk-btn hrk-btn--ghost" @click="drucken">Drucken / PDF</button>
          </div>
        </section>

        <!-- Fehler -->
        <div v-if="errorMsg" class="hrk-note hrk-note--danger" role="alert" style="margin-top:var(--hrk-space-4)">
          <strong>Fehler:</strong> {{ errorMsg }}
        </div>

        <!-- Laden -->
        <div v-if="loading" class="hrk-state hrk-state--mini">
          <div class="hrk-spinner" aria-hidden="true"></div>
          <p class="hrk-muted">Zeiterfassung wird ausgewertet …</p>
        </div>

        <!-- Ergebnistabelle -->
        <section v-if="!loading && zeilen.length" class="hrk-card tgv-result" aria-live="polite">
          <div class="tgv-result-head">
            <h2 class="hrk-h3" style="margin:0">Verteilung {{ formatMonat(yearMonth) }}</h2>
            <span class="hrk-badge hrk-badge--success">CHF {{ formatChf(betrag) }}</span>
          </div>

          <div class="hrk-note hrk-note--muted" style="margin:var(--hrk-space-3) 0">
            Methode: {{ methode === 'stunden' ? 'Arbeitsstunden' : 'Arbeitstage' }} · {{ zeilen.length }} {{ zeilen.length === 1 ? 'Mitarbeiter:in' : 'Mitarbeitende' }}
          </div>

          <div class="tgv-table-wrap">
            <table class="hrk-table tgv-table">
              <thead>
                <tr>
                  <th>Mitarbeiter:in</th>
                  <th class="tgv-num">{{ methode === 'stunden' ? 'Stunden' : 'Tage' }}</th>
                  <th class="tgv-num">Anteil CHF</th>
                  <th class="tgv-num">%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="z in zeilen" :key="z.emp" :class="{ 'tgv-row--odd': z._idx % 2 !== 0 }">
                  <td>{{ z.name }}</td>
                  <td class="tgv-num">{{ formatBasis(z.bas) }}</td>
                  <td class="tgv-num tgv-chf">{{ formatChf(z.anteil) }}</td>
                  <td class="tgv-num hrk-muted">{{ formatPct(z.bas, totalBasis) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="tgv-total">
                  <td><strong>Total</strong></td>
                  <td class="tgv-num"><strong>{{ formatBasis(totalBasis) }}</strong></td>
                  <td class="tgv-num tgv-chf"><strong>CHF {{ formatChf(totalAusgezahlt) }}</strong></td>
                  <td class="tgv-num"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Rundungs-Hinweis -->
          <p v-if="Math.abs(totalAusgezahlt - betrag) >= 0.01" class="hrk-hint" style="margin-top:var(--hrk-space-3)">
            Differenz von CHF {{ formatChf(Math.abs(betrag - totalAusgezahlt)) }} durch Runden (auf Rappen).
          </p>
          <p v-else class="hrk-hint" style="margin-top:var(--hrk-space-3)">
            ✓ Summe stimmt — kein Rundungsfehler.
          </p>
        </section>

        <!-- Leer-Zustand -->
        <div v-if="!loading && didCalc && !zeilen.length && !errorMsg" class="hrk-empty">
          Keine Zeiterfassung für {{ formatMonat(yearMonth) }} gefunden. Bitte prüf, ob für diesen Monat Einträge in der Zeiterfassung vorhanden sind.
        </div>
      </template>
    </main>
  </div>
</template>

<script>
/**
 * WeWeb Coded Component — trinkgeld-verteilung (HRklar)
 * Ruft die Supabase-RPC trinkgeld_verteilung(year_month, betrag, methode) auf
 * und zeigt eine CHF-Verteilungstabelle pro Mitarbeitenden.
 * Benötigt: authToken (User-JWT), apiKey (Supabase anon key).
 */
export default {
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: false, default: '' },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: false, default: () => ({}) },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  data() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      yearMonth: ym,
      betrag: 0,
      methode: 'tage',
      loading: false,
      errorMsg: '',
      zeilen: [],
      didCalc: false,
    };
  },
  computed: {
    baseUrl() {
      let u = this.content?.supabaseUrl || 'https://ztvqsxdudzdyqgeylujr.supabase.co';
      if (/nemxnflngcfrpamkuesm/.test(String(u))) u = 'https://ztvqsxdudzdyqgeylujr.supabase.co';
      return String(u).replace(/\/+$/, '');
    },
    authToken() { return (((this.content && this.content.authToken) || (typeof wwLib !== 'undefined' && wwLib.globalContext && wwLib.globalContext.auth && wwLib.globalContext.auth.session && wwLib.globalContext.auth.session.access_token) || '') || '').toString().trim(); },
    apiKey() { return ('sb_publishable_4rsRb_VB3l_45JO7sw0VSA_ODDS4CZc' || '').toString().trim(); },
    hasConfig() { return !!(this.authToken && this.apiKey); },
    authHeaders() {
      const t = this.authToken;
      return {
        apikey: this.apiKey,
        Authorization: t.startsWith('Bearer ') ? t : `Bearer ${t}`,
        'Content-Type': 'application/json',
      };
    },
    canCalc() { return this.hasConfig && !!this.yearMonth && this.betrag > 0; },
    currentYearMonth() {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    },
    totalBasis() { return this.zeilen.reduce((s, z) => s + (Number(z.bas) || 0), 0); },
    totalAusgezahlt() { return this.zeilen.reduce((s, z) => s + (Number(z.anteil) || 0), 0); },
  },
  watch: {
    'content.betragVorgabe'(v) {
      if (v && !this.betrag) this.betrag = Number(v) || 0;
    },
  },
  mounted() {
    const vorgabe = this.content?.betragVorgabe;
    if (vorgabe) this.betrag = Number(vorgabe) || 0;
  },
  methods: {
    fid(s) { return `tgv-${s}-${this.uid || 'x'}`; },
    emit(name, payload) { this.$emit('trigger-event', { name, event: payload || {} }); },

    async fetchWithTimeout(url, options = {}, timeout = 10000) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeout);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(tid);
      }
    },

    async berechnen() {
      if (!this.canCalc) return;
      this.loading = true;
      this.errorMsg = '';
      this.zeilen = [];
      this.didCalc = false;

      try {
        // 1) RPC trinkgeld_verteilung
        const rpcBody = JSON.stringify({
          p_year_month: this.yearMonth,
          p_betrag: Number(this.betrag),
          p_methode: this.methode,
        });
        const [rpcRes, empRes] = await Promise.all([
          this.fetchWithTimeout(`${this.baseUrl}/rest/v1/rpc/trinkgeld_verteilung`, {
            method: 'POST', headers: this.authHeaders, body: rpcBody,
          }),
          this.fetchWithTimeout(`${this.baseUrl}/rest/v1/employees?select=id,firstname,lastname&status=eq.aktiv`, {
            headers: { apikey: this.apiKey, Authorization: this.authHeaders.Authorization },
          }),
        ]);

        if (!rpcRes.ok) {
          const detail = await rpcRes.text().catch(() => '');
          if (rpcRes.status === 401) {
            this.errorMsg = 'Du bist nicht eingeloggt. Melde dich bitte neu an.';
          } else {
            this.errorMsg = `Berechnung fehlgeschlagen (${rpcRes.status}): ${detail.substring(0, 120)}`;
          }
          this.emit('error', { reason: 'rpc', status: rpcRes.status });
          return;
        }

        const rpcData = await rpcRes.json().catch(() => []);
        const empData = empRes.ok ? await empRes.json().catch(() => []) : [];

        // Mitarbeiternamen-Map
        const nameMap = {};
        for (const e of (Array.isArray(empData) ? empData : [])) {
          nameMap[e.id] = `${e.firstname || ''} ${e.lastname || ''}`.trim() || e.id;
        }

        // Normalisieren: Supabase gibt CASE-Column als "case" zurück
        const rows = Array.isArray(rpcData) ? rpcData : [];
        // RPC returns TABLE(employee_id uuid, basis numeric, anteil_chf numeric)
        this.zeilen = rows.map((r, i) => ({
          emp: r.employee_id,
          bas: Number(r.basis ?? 0),
          anteil: Number(r.anteil_chf ?? 0),
          name: nameMap[r.employee_id] || `Mitarbeiter:in ${i + 1}`,
          _idx: i,
        }));

        this.didCalc = true;
        this.emit('berechnet', { total: this.totalAusgezahlt, count: this.zeilen.length });
      } catch (e) {
        this.errorMsg = 'Keine Verbindung. Prüf dein Internet und versuch es nochmal.';
        this.emit('error', { reason: 'network' });
      } finally {
        this.loading = false;
      }
    },

    drucken() {
      window.print();
    },

    formatMonat(ym) {
      if (!ym) return '';
      try {
        const [y, m] = ym.split('-');
        return new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' })
          .format(new Date(Number(y), Number(m) - 1, 1));
      } catch { return ym; }
    },
    formatChf(v) {
      const n = Number(v) || 0;
      return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    },
    formatBasis(v) {
      const n = Number(v) || 0;
      if (this.methode === 'stunden') {
        // Dezimalstunden → Std:Min
        const h = Math.floor(n);
        const min = Math.round((n - h) * 60);
        return `${h}:${String(min).padStart(2, '0')}`;
      }
      return n % 1 === 0 ? String(n) : n.toFixed(1);
    },
    formatPct(bas, total) {
      if (!total) return '–';
      return `${Math.round((Number(bas) / Number(total)) * 100)} %`;
    },
  },
};
</script>

<style scoped>
/* ============================================================
   HRklar Design-Tokens — Vollständige Palette (v2)
   ============================================================ */
:root, .hrk-root {
  --hrk-bordeaux:        #7B2D3B;
  --hrk-bordeaux-dark:   #5E2129;
  --hrk-bordeaux-soft:   #F3E7E9;
  --hrk-creme:           #FBF8F3;
  --hrk-anthrazit:       #2C2C2C;
  --hrk-surface:         #FFFFFF;
  --hrk-surface-muted:   #F5F1EC;
  --hrk-border:          #ECE5D9;
  --hrk-border-strong:   #DAD2C6;
  --hrk-text:            #2C2C2C;
  --hrk-text-muted:      #6B6357;
  --hrk-success:         #2D6A4F; --hrk-success-bg: #D8F3DC;
  --hrk-warning:         #7D5200; --hrk-warning-bg: #FFF3CD;
  --hrk-danger:          #9B2335; --hrk-danger-bg:  #FDECEA;
  --hrk-info:            #1A5276;  --hrk-info-bg:    #D6EAF8;
  --hrk-neutral:         #5A5450; --hrk-neutral-bg: #EDEAE6;
  --hrk-font-head: "Fraunces", "Lora", Georgia, serif;
  --hrk-font-body: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --hrk-fs-h1: 1.9375rem; --hrk-fs-h2: 1.375rem; --hrk-fs-h3: 1.125rem;
  --hrk-fs-body: 1.0625rem;   --hrk-fs-small: .875rem;
  --hrk-fw-medium: 500;  --hrk-fw-semibold: 600;
  --hrk-lh-body: 1.6;
  --hrk-space-1: 4px;  --hrk-space-2: 8px;  --hrk-space-3: 12px;
  --hrk-space-4: 16px; --hrk-space-5: 24px; --hrk-space-6: 32px; --hrk-space-7: 48px;
  --hrk-radius-sm: 8px; --hrk-radius-md: 12px; --hrk-radius-lg: 14px; --hrk-radius-pill: 999px;
  --hrk-shadow-card: 0 1px 2px rgba(40,35,30,.05);
  --hrk-focus-ring: 0 0 0 3px rgba(123,45,59,.30);
  --hrk-tap-min: 44px;
  --hrk-page-max: 880px;
}
.hrk-root, .hrk-root * { box-sizing: border-box; }
.hrk-root { font-family: var(--hrk-font-body); font-size: var(--hrk-fs-body); line-height: var(--hrk-lh-body); color: var(--hrk-text); background: var(--hrk-creme); -webkit-font-smoothing: antialiased; }
.hrk-page { max-width: var(--hrk-page-max); margin: 0 auto; padding: var(--hrk-space-6) var(--hrk-space-4); }
.hrk-h1 { font-family: var(--hrk-font-head); font-size: var(--hrk-fs-h1); font-weight: var(--hrk-fw-semibold); line-height: 1.15; letter-spacing: -.01em; color: var(--hrk-bordeaux); margin: 0 0 var(--hrk-space-3); }
.hrk-h3 { font-family: var(--hrk-font-body); font-size: var(--hrk-fs-h3); font-weight: var(--hrk-fw-semibold); margin: 0 0 var(--hrk-space-2); }
.hrk-muted { color: var(--hrk-text-muted); }
.hrk-hint { color: var(--hrk-text-muted); font-size: var(--hrk-fs-small); margin-top: var(--hrk-space-1); }
.hrk-label { display: block; font-weight: var(--hrk-fw-medium); margin-bottom: var(--hrk-space-1); }
.hrk-field { display: block; margin-bottom: var(--hrk-space-4); }
.hrk-input, .hrk-select {
  width: 100%; min-height: var(--hrk-tap-min); padding: var(--hrk-space-3);
  font: inherit; color: var(--hrk-text); background: var(--hrk-surface);
  border: 1px solid var(--hrk-border); border-radius: var(--hrk-radius-sm);
}
.hrk-input:focus, .hrk-select:focus { outline: none; border-color: var(--hrk-bordeaux); box-shadow: var(--hrk-focus-ring); }
.hrk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--hrk-space-2);
  min-height: var(--hrk-tap-min); padding: 0 var(--hrk-space-5);
  font: inherit; font-weight: var(--hrk-fw-semibold);
  border-radius: var(--hrk-radius-md); border: 1px solid transparent;
  cursor: pointer; text-decoration: none; transition: background .15s, border-color .15s;
}
.hrk-btn:active { transform: translateY(1px); }
.hrk-btn:focus-visible { outline: none; box-shadow: var(--hrk-focus-ring); }
.hrk-btn--primary   { background: var(--hrk-bordeaux); color: #fff; }
.hrk-btn--primary:hover { background: var(--hrk-bordeaux-dark); }
.hrk-btn--ghost     { background: transparent; color: var(--hrk-bordeaux); }
.hrk-btn--ghost:hover { background: var(--hrk-bordeaux-soft); }
.hrk-btn[disabled] { opacity: .5; cursor: not-allowed; }
.hrk-actions { display: flex; flex-wrap: wrap; gap: var(--hrk-space-3); }
.hrk-card { background: var(--hrk-surface); border: 1px solid var(--hrk-border); border-radius: var(--hrk-radius-lg); box-shadow: var(--hrk-shadow-card); padding: var(--hrk-space-5); }
.hrk-card + .hrk-card { margin-top: var(--hrk-space-4); }
.hrk-badge { display: inline-flex; align-items: center; gap: var(--hrk-space-2);
  padding: 0; border-radius: 0; background: none;
  font-size: var(--hrk-fs-small); font-weight: var(--hrk-fw-semibold); line-height: 1.6; white-space: nowrap; }
.hrk-badge::before { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.hrk-badge--success { color: var(--hrk-success); }
.hrk-badge--neutral { color: var(--hrk-neutral); }
.hrk-note { border-left: 4px solid var(--hrk-info); background: var(--hrk-info-bg); padding: var(--hrk-space-3) var(--hrk-space-4); border-radius: var(--hrk-radius-sm); }
.hrk-note--danger { border-left-color: var(--hrk-danger); background: var(--hrk-danger-bg); }
.hrk-note--muted  { border-left-color: var(--hrk-border-strong); background: var(--hrk-surface-muted); color: var(--hrk-text-muted); }
.hrk-state { display: flex; flex-direction: column; align-items: center; gap: var(--hrk-space-3); padding: var(--hrk-space-7) var(--hrk-space-4); color: var(--hrk-text-muted); text-align: center; }
.hrk-state--mini { padding: var(--hrk-space-6) var(--hrk-space-3); }
.hrk-state__title { color: var(--hrk-text); font-weight: var(--hrk-fw-semibold); margin: 0; }
.hrk-spinner { width: 28px; height: 28px; border: 3px solid var(--hrk-border); border-top-color: var(--hrk-bordeaux); border-radius: 50%; animation: hrk-spin .8s linear infinite; }
@keyframes hrk-spin { to { transform: rotate(360deg); } }
.hrk-empty { text-align: center; color: var(--hrk-text-muted); padding: var(--hrk-space-7) var(--hrk-space-4); }
.hrk-table { width: 100%; border-collapse: collapse; font-size: var(--hrk-fs-body); }
.hrk-table th { text-align: left; font-weight: var(--hrk-fw-semibold); color: var(--hrk-text-muted); background: var(--hrk-surface-muted); padding: var(--hrk-space-3); border-bottom: 1px solid var(--hrk-border); }
.hrk-table td { padding: var(--hrk-space-3); border-bottom: 1px solid var(--hrk-border); }
.hrk-radio { display: flex; align-items: flex-start; gap: var(--hrk-space-3); min-height: var(--hrk-tap-min); padding: var(--hrk-space-3) var(--hrk-space-4); border: 1px solid var(--hrk-border); border-radius: var(--hrk-radius-md); background: var(--hrk-surface); cursor: pointer; transition: border-color .15s, background .15s; }
.hrk-radio:hover { border-color: var(--hrk-border-strong); }
.hrk-radio input { flex: none; width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--hrk-bordeaux); }
.hrk-radio--selected { border-color: var(--hrk-bordeaux); background: var(--hrk-bordeaux-soft); }
.hrk-radio__body { min-width: 0; }
.hrk-radio__title { display: block; font-weight: var(--hrk-fw-semibold); }
.hrk-radio__hint { display: block; color: var(--hrk-text-muted); font-size: var(--hrk-fs-small); margin-top: 2px; }

/* Komponenten-spezifisch */
.tgv-head { margin-bottom: var(--hrk-space-5); }
.tgv-form-card { margin-bottom: var(--hrk-space-4); }
.tgv-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--hrk-space-4); }
.tgv-methode { display: grid; grid-template-columns: 1fr 1fr; gap: var(--hrk-space-3); }
.tgv-result-head { display: flex; align-items: center; justify-content: space-between; gap: var(--hrk-space-3); flex-wrap: wrap; margin-bottom: var(--hrk-space-2); }
.tgv-table-wrap { overflow-x: auto; }
.tgv-table tfoot td { background: var(--hrk-bordeaux-soft); font-weight: var(--hrk-fw-semibold); border-top: 2px solid var(--hrk-bordeaux); }
.tgv-num { text-align: right; font-variant-numeric: tabular-nums; }
.tgv-chf { color: var(--hrk-anthrazit); }
.tgv-row--odd td { background: var(--hrk-surface-muted); }
.tgv-total td { background: var(--hrk-bordeaux-soft) !important; }

@media (max-width: 600px) {
  :root, .hrk-root { --hrk-fs-h1: 1.625rem; }
  .hrk-page { padding: var(--hrk-space-4) var(--hrk-space-3); }
  .tgv-form-grid { grid-template-columns: 1fr; }
  .tgv-methode { grid-template-columns: 1fr; }
  .hrk-actions { flex-direction: column; }
  .hrk-actions .hrk-btn { width: 100%; }
  .hrk-table th, .hrk-table td { padding: var(--hrk-space-2); font-size: var(--hrk-fs-small); }
}

@media print {
  .hrk-root { background: #fff; }
  .hrk-btn, .tgv-form-card { display: none !important; }
  .hrk-card { box-shadow: none; border: 1px solid #ddd; }
}
</style>
