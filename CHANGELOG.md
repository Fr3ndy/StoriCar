# Changelog

Tutte le modifiche rilevanti di Storicar sono documentate in questo file.
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

> **Nota per gli sviluppatori:** Ogni volta che fai un rilascio, aggiorna anche `src/lib/changelog.js`
> e la versione in `package.json`. Il GitHub Action `.github/workflows/release.yml` creerà
> automaticamente una Release su GitHub quando fai push di un tag `v*.*.*`.

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
