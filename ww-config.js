export default {
  editor: {
    label: { en: 'Tip Distribution', de: 'Trinkgeld-Verteilung' },
    icon: 'euro',
  },
  triggerEvents: [
    { name: 'berechnet', label: { en: 'On calculated', de: 'Berechnung fertig' }, event: { total: 0, count: 0 } },
    { name: 'error', label: { en: 'On error', de: 'Fehler' }, event: { reason: '' } },
  ],
  properties: {
    authToken: {
      label: { en: 'User JWT (auth token)', de: 'User-JWT (Login-Token)' },
      type: 'Text', section: 'settings', bindable: true, defaultValue: '',
      /* wwEditor:start */
      bindingValidation: { type: 'string', tooltip: 'Access Token des eingeloggten Users (Supabase Auth). Bearer wird automatisch ergaenzt.' },
      /* wwEditor:end */
    },
    apiKey: {
      label: { en: 'Supabase anon/publishable key', de: 'Supabase Anon-/Publishable-Key' },
      type: 'Text', section: 'settings', bindable: true, defaultValue: '',
      /* wwEditor:start */
      bindingValidation: { type: 'string', tooltip: 'Oeffentlicher Anon-/Publishable-Key. NIE den service_role-Key verwenden.' },
      /* wwEditor:end */
    },
    supabaseUrl: {
      label: { en: 'Supabase URL', de: 'Supabase URL' },
      type: 'Text', section: 'settings', bindable: true,
      defaultValue: 'https://ztvqsxdudzdyqgeylujr.supabase.co',
    },
    betragVorgabe: {
      label: { en: 'Preset amount (CHF)', de: 'Vorgegebener Betrag (CHF)' },
      type: 'Number', section: 'settings', bindable: true, defaultValue: 0,
      /* wwEditor:start */
      bindingValidation: { type: 'number', tooltip: 'Optionaler Standardbetrag. User kann ihn im Formular ueberschreiben.' },
      /* wwEditor:end */
    },
  },
};
