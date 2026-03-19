# Come fare una Release di StoriCar

## Come funziona il sistema

Il sistema di release è composto da tre parti che lavorano insieme:

**`src/lib/changelog.js`** è la sorgente di verità per l'app. Contiene l'elenco di tutte le versioni con titoli, emoji, highlights e lista dei cambiamenti. L'app lo usa per mostrare il popup "Novità" e la pagina Changelog.

**`CHANGELOG.md`** è il file leggibile da umani (e da GitHub) con lo stesso contenuto in formato testuale standard. Viene letto dal GitHub Action per creare automaticamente le note della release su GitHub.

**`.github/workflows/release.yml`** è il workflow che si attiva quando fai push di un tag `v*.*.*`. Legge la sezione corrispondente da `CHANGELOG.md` e crea una GitHub Release con quelle note.

---

## Procedura per rilasciare una nuova versione

### 1. Aggiorna `src/lib/changelog.js`

Modifica `APP_VERSION` con il nuovo numero di versione e aggiungi una nuova voce in cima all'array `changelog`:

```js
export const APP_VERSION = '1.2.0'

export const changelog = [
  {
    version: '1.2.0',
    date: '2026-04-01',
    title: 'Titolo della versione',
    emoji: '🎉',
    highlights: [
      'Breve frase che descrive il cambiamento principale',
      'Altra novità importante',
    ],
    changes: [
      { type: 'new',      text: 'Nuova funzionalità aggiunta' },
      { type: 'improved', text: 'Funzionalità esistente migliorata' },
      { type: 'fixed',    text: 'Bug risolto' },
      { type: 'removed',  text: 'Funzionalità rimossa' },
    ],
  },
  // ... versioni precedenti
]
```

I tipi di cambiamento disponibili sono: `new`, `improved`, `fixed`, `removed`.

---

### 2. Aggiorna `CHANGELOG.md`

Aggiungi una nuova sezione in cima (sotto `## [Unreleased]`), seguendo il formato esistente:

```markdown
## [1.2.0] - 2026-04-01

### Aggiunto
- Nuova funzionalità aggiunta

### Migliorato
- Funzionalità esistente migliorata

### Corretto
- Bug risolto
```

---

### 3. Aggiorna `package.json`

```json
{
  "version": "1.2.0"
}
```

---

### 4. Fai commit e push

```bash
git add .
git commit -m "chore: release v1.2.0"
git push
```

---

### 5. Crea e pusha il tag

```bash
git tag v1.2.0
git push origin v1.2.0
```

A questo punto il GitHub Action parte automaticamente, legge il `CHANGELOG.md` e crea la Release su GitHub con le note della versione.

---

## Tipi di versione

Segui il **Semantic Versioning** (semver):

| Tipo | Quando usarlo | Esempio |
|------|--------------|---------|
| **Patch** `x.x.+1` | Bug fix, piccole correzioni | `1.1.0` → `1.1.1` |
| **Minor** `x.+1.0` | Nuove funzionalità retrocompatibili | `1.1.0` → `1.2.0` |
| **Major** `+1.0.0` | Cambiamenti che rompono la compatibilità | `1.1.0` → `2.0.0` |

Per le **prerelease** (beta, RC), usa un suffisso con trattino — il workflow le marcherà automaticamente come pre-release su GitHub:

```bash
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1
```

---

## Prerequisiti su GitHub

Nella pagina del repository vai in **Settings → Secrets and variables → Actions** e aggiungi:

- `VITE_SUPABASE_URL` — l'URL del tuo progetto Supabase
- `VITE_SUPABASE_ANON_KEY` — la chiave pubblica Supabase

Questi sono necessari se il workflow dovesse includere una build in futuro. Attualmente il workflow crea solo la Release senza buildare.
