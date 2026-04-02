# Changelog

Tutte le modifiche rilevanti di Storicar sono documentate in questo file.
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

> **Nota per gli sviluppatori:** Ogni volta che fai un rilascio, aggiorna anche `src/lib/changelog.js`
> e la versione in `package.json`. Il GitHub Action `.github/workflows/release.yml` creerà
> automaticamente una Release su GitHub quando fai push di un tag `v*.*.*`.

---

## [1.4.0] — 2026-04-02 🔧 Fix prezzi carburante, validazione coordinate, consumo

### Aggiunto
- **Prezzi carburante — warning aggiornamento:** banner globale giallo se NESSUN impianto ha prezzi aggiornati oggi; badge "Dato del DD/MM/YYYY" per singolo distributore se non aggiornato; nessun banner se almeno uno è aggiornato oggi
- **Validazione coordinate:** blocco di tutte le chiamate a `fuel-prices.php` se le coordinate non sono valide (null, NaN, o coppia `0,0`); messaggio UI "Posizione non disponibile"
- **Strategia fallback coordinate** (priorità): 1) selezione manuale mappa, 2) `settings.fuelMapLat/Lng`, 3) GPS dispositivo, 4) ultimo rifornimento con coordinate — nessuna chiamata API se tutte falliscono
- **FUEL_FAMILIES** aggiunto in `FuelPricesView.vue` (era assente nel branch develop, causava errore runtime)

### Migliorato
- **Raggio ricerca carburanti:** max 100 km (era 50); fallback a 100 se non fornito o non valido; sia in `fuel-prices.php` che in `useFuelPrices.js`
- **`isPriceToday`:** ora usa `.slice(0, 10)` per confrontare la data ignorando orario e fuso; `todayStr` calcolato con `toLocaleDateString('sv-SE')` per evitare sfasamenti UTC

### Corretto
- **`coverError` non dichiarato** in `VehiclesView.vue`: aggiunto `const coverError = ref('')` (causava errore runtime all'apertura del form modifica veicolo)
- **`consumptionClass is not a function`**: aggiunta funzione `consumptionClass(record)` separata da `consumptionColor(kmPerL)` (il template le chiamava entrambe)
- **`lat=0&lng=0` inviato all'API**: `Number(null) === 0` faceva passare la validazione — aggiunto guard `if (n_lat === 0 && n_lng === 0) return false` in tutti e tre i punti di validazione
- **`dataReady` usato prima della dichiarazione** in `HomeView.vue`: spostato `useStorage()` in cima allo script

### Rimosso
- **Stime consumo dalla pagina Rifornimenti:** rimossi `estimateMap`, `accurateMap`, `getConsumptionDisplay`, `formatConsumption`, `getEstimateDisplay`, `getAccurateDisplay`, `consumptionClass`, `consumptionColor` e relativi CSS — la pagina mostra solo i dati effettivi del rifornimento

---

## [1.3.0] — 2026-03-22 🗺️ Prezzi carburante & fix consumo

### Aggiunto
- Immagine di copertina del veicolo come sfondo sfocato nella card hero di HomeView
- Layout desktop: colonna centrata a 600px con sfondo scuro laterale e box-shadow
- Icona impostazioni nella topbar (sostituisce il toggle tema)
- Banner beta spostato sopra la navbar inferiore
- Scrollbar sottile (4px) sul contenuto principale, diventa blu al hover

### Migliorato
- Mappa prezzi carburante: zoom in alto a destra (non si sovrappone più ai chip)
- Nomi carburanti aggiornati ai nomi esatti API MIMIT (Benzina, Gasolio, Metano, GPL, L-GNC, GNL + varianti premium brand-specific)
- Chip mappa raggruppati in 6 famiglie: le varianti premium (Blue Super, Blue Diesel, HVOlution, HVO, Gasolio Premium, Supreme Diesel, Hi-Q Diesel, HiQ Perform+) appaiono nel pannello dettaglio ma non come chip separate
- Sezione "Prezzi area" completamente ridisegnata: lista per famiglia con min/media/max e numero impianti, cliccabile per cambiare carburante sulla mappa

### Corretto
- Calcolo consumo con metodo fill-to-fill: il consumo (km/L) è calcolato solo tra due rifornimenti a "pieno completo", sommando i litri di tutti i parziali intermedi — i valori anomali (es. 25,9 km/L) sono eliminati
- Aggiunto toggle "Pieno completo" nel form di aggiunta rifornimento (default: parziale); i rifornimenti parziali mostrano un badge "parziale" al posto del consumo

---

## [1.2.0] — 2026-03-19 ✨ Profilo pubblico & modalità ospite

### Aggiunto
- Foto profilo e username pubblico personalizzabile
- Pagina pubblica del profilo (ancora in sviluppo)
- Modalità ospite: accesso senza account con dati salvati solo in locale

### Migliorato
- Interfaccia grafica rinnovata con nuovo stile
- Pagina dei costi carburante aggiornata
- Aggiunta rifornimento ora suggerisce il prezzo del fornitore selezionato

### Corretto
- Risolti numerosi bug minori

---

## [1.0.0] — 2025-06-01 🚀 Lancio iniziale

### Aggiunto
- Tracciamento rifornimenti con odometro e calcolo consumo automatico
- Statistiche consumi (km/L o L/100km, configurabile)
- Gestione scadenze: assicurazione, bollo, tagliando, revisione, gomme
- Notifiche push per scadenze imminenti
- Mappa prezzi carburante area Cagliari in tempo reale
- Registrazione spese extra (manutenzione, pedaggi, lavaggi, ecc.)
- Profilo pubblico condivisibile via link
- Accesso con Google o modalità ospite (dati solo locali)
- Tema chiaro e scuro
- PWA installabile su dispositivi mobili e desktop
- Sincronizzazione cloud con Supabase

---

[1.2.0]: https://github.com/Fr3ndy/StoriCar/releases/tag/v1.2.0
[1.0.0]: https://github.com/Fr3ndy/StoriCar/releases/tag/v1.0.0
