# Storicar

**Storicar** is a personal vehicle logbook to track fuel refills, expenses, deadlines, and statistics for all your cars.

> Note: the app UI and all in-app texts are in **Italian**.

## Features

- **Fuel refills** — log every fill-up with date, liters, price, and odometer reading
- **Expenses** — track all vehicle-related costs (insurance, servicing, etc.)
- **Deadlines** — reminders for road tax, MOT, insurance, and other appointments
- **Statistics** — charts for fuel consumption, cost per km, and expense trends
- **Fuel prices** — real-time fuel prices from nearby stations
- **Map** — geographic view of fuel stations
- **Multi-vehicle** — manage multiple vehicles from a single account
- **PWA** — installable on smartphones, works as a native app
- **Light / dark theme**

## Tech stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/) — database, authentication, and storage
- [Chart.js](https://www.chartjs.org/) — statistics charts
- [Leaflet](https://leafletjs.com/) — fuel station map
- PWA via [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Fr3ndy/Storicar.git
cd Storicar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials (see below).

### 4. Start the development server

```bash
npm run dev
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API**
3. Copy the `Project URL` and `anon public key`
4. Paste them into your `.env` file

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase publishable key |
| `VITE_FUEL_PRICES_URL` | URL of the PHP backend for fuel prices |

> **Note:** the `.env` file is listed in `.gitignore` and is never committed.

## Production build

```bash
npm run build
```

Output is generated in the `dist/` folder.

## Deploy

The project is configured for automatic deployment to **GitHub Pages** via GitHub Actions.
Every push to the `main` branch triggers a build and deploy automatically.

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for details.

To enable deployment:
1. Go to **Settings → Secrets and variables → Actions** in your repository
2. Add the required secrets (see `.env.example`)
3. Go to **Settings → Pages** and set Source to **GitHub Actions**

## License

MIT
