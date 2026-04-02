// ── Storicar Changelog ─────────────────────────────────────────────────────
// Versione corrente dell'app. Aggiorna questo campo ad ogni rilascio.
export const APP_VERSION = '1.4.0'

// Tipi di cambiamento
// 'new'      → nuova funzionalità
// 'improved' → miglioramento esistente
// 'fixed'    → bug fix
// 'removed'  → funzionalità rimossa

export const changelog = [
  {
    version: '1.4.0',
    date: '2026-04-02',
    title: 'Fix prezzi carburante & coordinate',
    emoji: '🔧',
    highlights: [
      'Warning prezzi non aggiornati (globale e per singolo distributore)',
      'Validazione coordinate GPS con fallback in 4 step',
      'Pagina rifornimenti semplificata: rimosso calcolo stime consumo',
    ],
    changes: [
      { type: 'new', text: 'Banner giallo se nessun distributore ha prezzi aggiornati oggi; badge per stazione se il dato è vecchio' },
      { type: 'new', text: 'Validazione coordinate: nessuna chiamata API con coordinate nulle, NaN o (0,0)' },
      { type: 'new', text: 'Fallback coordinate in 4 step: selezione manuale → impostazioni → GPS → ultimo rifornimento' },
      { type: 'improved', text: 'Raggio ricerca carburanti: massimo 100 km (era 50), fallback 100 se non specificato' },
      { type: 'improved', text: 'Rilevamento data prezzi aggiornato: gestisce formato con orario e fuso orario correttamente' },
      { type: 'fixed', text: 'Errore runtime "coverError is not defined" all\'apertura modifica veicolo' },
      { type: 'fixed', text: 'Errore runtime "consumptionClass is not a function" nella pagina rifornimenti' },
      { type: 'fixed', text: 'Coordinate lat=0&lng=0 inviate all\'API quando le impostazioni erano null' },
      { type: 'removed', text: 'Stime consumo dalla pagina Rifornimenti: rimossi calcoli estimateMap/accurateMap e relative pillole' },
    ]
  },
  {
    version: '1.3.0',
    date: '2026-03-22',
    title: 'Prezzi carburante & fix consumo',
    emoji: '🗺️',
    highlights: [
      'Chip carburante raggruppati per famiglia',
      'Sezione prezzi area ridisegnata',
      'Fix calcolo consumo per rifornimento',
    ],
    changes: [
      { type: 'new', text: 'Copertina veicolo come sfondo sfocato nella card principale' },
      { type: 'new', text: 'Layout desktop: colonna centrata 600px con sfondo scuro' },
      { type: 'new', text: 'Icona impostazioni nella topbar' },
      { type: 'improved', text: 'Chip mappa carburanti raggruppati in 6 famiglie (le varianti premium appaiono nel dettaglio stazione)' },
      { type: 'improved', text: 'Sezione "Prezzi area" ridisegnata: righe per famiglia con min/media/max, cliccabili' },
      { type: 'improved', text: 'Nomi carburanti aggiornati ai nomi esatti API MIMIT (inclusi premium brand-specific)' },
      { type: 'improved', text: 'Zoom mappa spostato in alto a destra per non sovrapporsi ai chip' },
      { type: 'fixed', text: 'Calcolo consumo fill-to-fill: km/L calcolato solo tra due pieni completi, sommando i litri dei parziali intermedi — eliminati valori anomali come 25,9 km/L' },
      { type: 'new', text: 'Toggle "Pieno completo" nel form rifornimento (default: parziale): i parziali mostrano un badge viola invece del consumo' },
    ]
  },
  {
    version: '1.2.0',
    date: '2026-03-19',
    title: 'Profilo pubblico & modalità ospite',
    emoji: '✨',
    highlights: [
      'Aggiunta foto profilo e username pubblico',
      'Modalità ospite migliorata',
      'Interfaccia rinnovata',
    ],
    changes: [
      { type: 'new', text: 'Foto profilo e username pubblico personalizzabile' },
      { type: 'new', text: 'Pagina pubblica del profilo (in sviluppo)' },
      { type: 'new', text: 'Modalità ospite: accesso senza account con dati locali' },
      { type: 'improved', text: 'Interfaccia grafica rinnovata con nuovo stile' },
      { type: 'improved', text: 'Pagina dei costi carburante aggiornata' },
      { type: 'improved', text: 'Aggiunta rifornimento ora suggerisce il prezzo del fornitore' },
      { type: 'fixed', text: 'Risolti numerosi bug minori' },
    ]
  },
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
