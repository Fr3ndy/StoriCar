// ── Storicar Changelog ─────────────────────────────────────────────────────
// Versione corrente dell'app. Aggiorna questo campo ad ogni rilascio.
export const APP_VERSION = '1.1.0'

// Tipi di cambiamento
// 'new'      → nuova funzionalità
// 'improved' → miglioramento esistente
// 'fixed'    → bug fix
// 'removed'  → funzionalità rimossa

export const changelog = [
  {
    version: '1.0.0',
    date: '2025-06-01',
    title: 'Lancio iniziale',
    emoji: '🚀',
    highlights: [
      'Prima versione pubblica di Storicar',
    ],
    changes: [
      { type: 'new', text: 'Tracciamento rifornimenti con odometro e consumo automatico' },
      { type: 'new', text: 'Statistiche consumi (km/L o L/100km configurabile)' },
      { type: 'new', text: 'Gestione scadenze: assicurazione, bollo, tagliando, ecc.' },
      { type: 'new', text: 'Notifiche push per scadenze imminenti' },
      { type: 'new', text: 'Mappa prezzi carburante area Cagliari in tempo reale' },
      { type: 'new', text: 'Registrazione spese extra (manutenzione, pedaggi, ecc.)' },
      { type: 'new', text: 'Profilo pubblico condivisibile via link' },
      { type: 'new', text: 'Accesso con Google o modalità ospite (solo locale)' },
      { type: 'new', text: 'Tema chiaro e scuro' },
      { type: 'new', text: 'PWA installabile su dispositivi mobili e desktop' },
      { type: 'new', text: 'Sincronizzazione cloud con Supabase' },
    ]
  }
]

// Restituisce true se l'utente non ha ancora visto questa versione
export function isNewVersion() {
  const lastSeen = localStorage.getItem('storicar_last_version')
  return lastSeen !== APP_VERSION
}

// Segna la versione corrente come vista
export function markVersionSeen() {
  localStorage.setItem('storicar_last_version', APP_VERSION)
}
