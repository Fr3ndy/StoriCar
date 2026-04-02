<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useStatistics } from '../composables/useStatistics'

const router = useRouter()
const { data, dataReady, getDefaultVehicleId, setDefaultVehicle, getDeadlinesByVehicle } = useStorage()

// ── Widget prezzi carburante ──────────────────────────────────────────────────
// Richiede coordinate valide: cerca prima in settings, poi nel GPS, poi nell'ultimo rifornimento.
// NON parte senza coordinate (evita request vuote a fuel-prices.php).
const fuelPricesData = ref(null)

function isValidCoordHome(lat, lng) {
  return lat != null && lng != null &&
    !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
    Number(lat) >= -90 && Number(lat) <= 90 &&
    Number(lng) >= -180 && Number(lng) <= 180
}

async function loadFuelWidget() {
  const base = import.meta.env.VITE_FUEL_PRICES_URL
  if (!base) return // servizio non configurato

  let lat = null, lng = null

  // 1. Settings salvate
  const sLat = data.value.settings?.fuelMapLat
  const sLng = data.value.settings?.fuelMapLng
  if (isValidCoordHome(sLat, sLng)) {
    lat = Number(sLat); lng = Number(sLng)
    console.info('[HomeView] Widget prezzi: fonte coordinate = settings')
  }

  // 2. Geolocalizzazione dispositivo (solo se settings vuote)
  if (lat == null && navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
      )
      lat = pos.coords.latitude; lng = pos.coords.longitude
      console.info('[HomeView] Widget prezzi: fonte coordinate = GPS')
    } catch {
      console.info('[HomeView] Widget prezzi: GPS non disponibile')
    }
  }

  // 3. Ultimo rifornimento con coordinate
  if (lat == null) {
    const records = data.value.fuelRecords ?? []
    const withCoord = records
      .filter(r => r.location && isValidCoordHome(r.location.lat, r.location.lng))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (withCoord.length) {
      lat = Number(withCoord[0].location.lat)
      lng = Number(withCoord[0].location.lng)
      console.info('[HomeView] Widget prezzi: fonte coordinate = ultimo rifornimento')
    }
  }

  // 4. Nessuna fonte: non chiamare l'API
  if (!isValidCoordHome(lat, lng)) {
    console.warn('[HomeView] Widget prezzi: nessuna coordinata disponibile, chiamata bloccata.', {
      'settings.fuelMapLat': sLat,
      'settings.fuelMapLng': sLng,
    })
    return
  }

  try {
    const km = Math.min(data.value.settings?.fuelMapRadius || 100, 100)
    const params = new URLSearchParams({ lat, lng, km })
    const res = await fetch(`${base}?${params}`)
    if (res.ok) {
      const json = await res.json()
      if (json.ok) fuelPricesData.value = json
    }
  } catch {}
}

// Carica il widget prezzi solo quando i dati utente sono pronti.
// Evita request con settings ancora null (sequenza: mount → dataReady → loadFuelWidget).
let widgetLoaded = false
watch(dataReady, async (ready) => {
  if (ready && !widgetLoaded) {
    widgetLoaded = true
    await loadFuelWidget()
  }
}, { immediate: true })

const prezziWidget = computed(() => {
  if (!fuelPricesData.value?.stats) return []
  return Object.entries(fuelPricesData.value.stats)
    .filter(([, s]) => s?.self?.min != null)
    .map(([nome, s]) => ({ nome, min: s.self.min, media: s.self.media }))
    .slice(0, 3)
})

const selectedVehicleId = ref(null)
const vehicles           = computed(() => data.value.vehicles)
const hasVehicles        = computed(() => vehicles.value.length > 0)
const defaultVehicleId   = computed(() => data.value.settings?.defaultVehicleId)

const stats = useStatistics(selectedVehicleId)

watch(dataReady, (ready) => {
  if (!ready) return
  const defaultId = getDefaultVehicleId()
  if (defaultId && vehicles.value.find(v => v.id === defaultId)) {
    selectedVehicleId.value = defaultId
  } else if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }
}, { immediate: true })

function onVehicleChange(e) {
  selectedVehicleId.value = e.target.value
  setDefaultVehicle(e.target.value)
}

function fmt(num, dec = 2) {
  if (num == null || isNaN(num)) return '—'
  return num.toFixed(dec).replace('.', ',')
}
function fmtCur(num) {
  if (num == null || isNaN(num)) return '—'
  return '€\u00a0' + fmt(num)
}

const upcomingDeadlines = computed(() => {
  if (!selectedVehicleId.value) return []
  return getDeadlinesByVehicle(selectedVehicleId.value).filter(dl => {
    const today = new Date(); today.setHours(0,0,0,0)
    const days  = Math.ceil((new Date(dl.expiryDate) - today) / 86400000)
    return days <= (dl.reminderDays || 30)
  })
})

const dlLabels = {
  assicurazione: { label: 'Assicurazione', icon: '🛡️' },
  bollo:         { label: 'Bollo',          icon: '📄' },
  tagliando:     { label: 'Tagliando',      icon: '🔧' },
  revisione:     { label: 'Revisione',      icon: '🔍' },
  gomme:         { label: 'Cambio Gomme',   icon: '⚙️' },
  altro:         { label: 'Altro',          icon: '📌' }
}

function dlDays(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const exp   = new Date(dateStr); exp.setHours(0,0,0,0)
  return Math.ceil((exp - today) / 86400000)
}

function dlStatus(dl) {
  const d = dlDays(dl.expiryDate)
  if (d < 0)  return 'expired'
  if (d <= (dl.reminderDays || 30)) return 'expiring'
  return 'ok'
}

function dlLabel(dl) {
  const d = dlDays(dl.expiryDate)
  if (d < 0) return `Scaduta ${Math.abs(d)}gg fa`
  if (d === 0) return 'Scade oggi'
  return `${d} giorni`
}
</script>

<template>
  <div>

    <!-- ── Empty state ── -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
      </svg>
      <h2>Benvenuto in Storicar</h2>
      <p>Aggiungi il tuo primo veicolo per iniziare</p>
      <button class="btn btn-primary" style="margin-top:20px" @click="router.push('/vehicles')">
        Aggiungi veicolo
      </button>
    </div>

    <!-- ── Dashboard ── -->
    <div v-else class="dashboard">

      <!-- Vehicle card -->
      <div class="vehicle-card">
        <div class="vc-top">
          <div class="vc-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
            </svg>
          </div>
          <div class="vc-info">
            <div class="vc-name">{{ stats.vehicle.value?.name || 'Veicolo' }}</div>
            <div class="vc-sub">
              {{ [stats.vehicle.value?.brand, stats.vehicle.value?.model].filter(Boolean).join(' ') }}
              <template v-if="stats.vehicle.value?.plate"> · <strong>{{ stats.vehicle.value.plate }}</strong></template>
            </div>
          </div>
          <svg class="vc-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <div class="vc-odo">
          <span class="vc-odo-num">{{ stats.lastOdometer.value > 0 ? stats.lastOdometer.value.toLocaleString('it-IT') : '—' }}</span>
          <span class="vc-odo-unit">km</span>
        </div>
        <!-- invisible select for vehicle switching -->
        <select class="vc-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Quick actions -->
      <div class="actions-grid">
        <button class="action-tile primary" @click="router.push('/fuel/add')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <span>Rifornimento</span>
        </button>
        <button class="action-tile" @click="router.push('/expenses/add')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
          <span>Spesa</span>
        </button>
        <button class="action-tile" @click="router.push('/map')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <span>Mappa</span>
        </button>
      </div>

      <!-- Stats grid -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmt(stats.formattedConsumption.value.value) }}</div>
          <div class="stat-label">{{ stats.formattedConsumption.value.unit }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-amber">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmtCur(stats.totalFuelSpent.value) }}</div>
          <div class="stat-label">Carburante</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmt(stats.totalKmDriven.value, 0) }}</div>
          <div class="stat-label">Km percorsi</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmtCur(stats.totalSpent.value) }}</div>
          <div class="stat-label">Totale speso</div>
        </div>
      </div>

      <!-- Scadenze imminenti -->
      <div v-if="upcomingDeadlines.length > 0" class="section">
        <div class="section-header">
          <span class="section-title">Scadenze</span>
          <button class="section-link" @click="router.push('/deadlines')">Vedi tutte</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div
            v-for="(dl, i) in upcomingDeadlines"
            :key="dl.id"
            class="dl-row"
            :class="{ 'dl-row-last': i === upcomingDeadlines.length - 1 }"
            @click="router.push('/deadlines')"
          >
            <span class="dl-emoji">{{ dlLabels[dl.type]?.icon || '📌' }}</span>
            <div class="dl-info">
              <div class="dl-name">{{ dlLabels[dl.type]?.label || dl.type }}</div>
              <div v-if="dl.description" class="dl-desc">{{ dl.description }}</div>
            </div>
            <span class="dl-badge" :class="dlStatus(dl)">{{ dlLabel(dl) }}</span>
          </div>
        </div>
      </div>

      <!-- Ultimi rifornimenti -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Ultimi rifornimenti</span>
          <button class="section-link" @click="router.push('/fuel')">Vedi tutti</button>
        </div>
        <div v-if="stats.fuelRecords.value.length === 0" class="card" style="text-align:center;color:var(--text-secondary);font-size:14px;padding:20px">
          Nessun rifornimento registrato
        </div>
        <div v-else class="card" style="padding:0;overflow:hidden">
          <div
            v-for="(r, i) in stats.fuelRecords.value.slice(0, 3)"
            :key="r.id"
            class="fuel-row"
            :class="{ 'fuel-row-last': i === Math.min(stats.fuelRecords.value.length, 3) - 1 }"
            @click="router.push(`/fuel/edit/${r.id}`)"
          >
            <div class="fuel-date-box">
              <span class="fuel-day">{{ new Date(r.date).getDate().toString().padStart(2,'0') }}</span>
              <span class="fuel-month">{{ new Date(r.date).toLocaleDateString('it-IT', { month:'short' }) }}</span>
            </div>
            <div class="fuel-info">
              <div class="fuel-main">{{ fmtCur(r.amount) }}</div>
              <div class="fuel-sub">{{ fmt(r.liters) }} L · {{ fmt(r.pricePerLiter, 3) }} €/L<span v-if="r.kmDriven"> · {{ Math.round(r.kmDriven) }} km</span></div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="fuel-chevron">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Riepilogo consumi -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Consumi</span>
        </div>
        <div class="card">
          <div class="list-item">
            <span>Costo per km</span>
            <strong class="list-item-value">{{ fmt(stats.costPerKm.value, 3) }} €/km</strong>
          </div>
          <div class="list-item">
            <span>Prezzo medio carb.</span>
            <strong class="list-item-value">{{ fmt(stats.averagePricePerLiter.value, 3) }} €/L</strong>
          </div>
          <div class="list-item">
            <span>Spesa media mensile</span>
            <strong class="list-item-value">{{ fmtCur(stats.averageFuelSpentPerMonth.value) }}</strong>
          </div>
          <div class="list-item">
            <span>Totale litri</span>
            <strong class="list-item-value">{{ fmt(stats.totalLiters.value) }} L</strong>
          </div>
        </div>
      </div>

      <!-- Fuel prices widget -->
      <div v-if="prezziWidget.length" class="section">
        <div class="section-header">
          <span class="section-title">Prezzi area Cagliari</span>
          <button class="section-link" @click="router.push('/fuel-prices')">Mappa →</button>
        </div>
        <div class="prices-strip" @click="router.push('/fuel-prices')">
          <div v-for="p in prezziWidget" :key="p.nome" class="prices-item">
            <div class="prices-nome">{{ p.nome }}</div>
            <div class="prices-val">{{ p.min.toFixed(3).replace('.', ',') }}<span>€/L</span></div>
            <div class="prices-media">media {{ p.media.toFixed(3).replace('.', ',') }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; }

/* ── Vehicle card ── */
.vehicle-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 18px;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.vc-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }

.vc-icon {
  width: 42px; height: 42px;
  border-radius: var(--r);
  background: var(--primary-soft); color: var(--primary);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
[data-theme="dark"] .vc-icon { background: var(--primary-glow); color: #93c5fd; }
.vc-icon svg { width: 22px; height: 22px; }

.vc-info { flex: 1; min-width: 0; }
.vc-name { font-size: 16px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.vc-sub  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.vc-sub strong { font-weight: 700; color: var(--text-primary); }

.vc-chevron { width: 16px; height: 16px; color: var(--text-tertiary); flex-shrink: 0; }

.vc-odo { display: flex; align-items: baseline; gap: 5px; }
.vc-odo-num { font-size: 40px; font-weight: 900; color: var(--text-primary); letter-spacing: -2px; line-height: 1; }
.vc-odo-unit { font-size: 15px; font-weight: 600; color: var(--text-secondary); }

.vc-select { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; font-size: 16px; }

/* ── Quick actions ── */
.actions-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.action-tile {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; padding: 16px 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all .15s;
  box-shadow: var(--shadow-sm);
}
.action-tile:active { transform: scale(.96); opacity: .85; }

.action-tile-icon {
  width: 36px; height: 36px;
  border-radius: var(--r);
  background: var(--bg-secondary);
  display: flex; align-items: center; justify-content: center;
}
.action-tile-icon svg { width: 18px; height: 18px; }

.action-tile.primary {
  background: var(--primary); color: white;
  border-color: transparent;
  box-shadow: 0 3px 12px rgba(37,99,235,.28);
}
.action-tile.primary .action-tile-icon { background: rgba(255,255,255,0.18); }

/* ── Sections ── */
.section { margin-bottom: 10px; }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; padding: 0 2px;
}
.section-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.section-link {
  font-size: 12px; font-weight: 600; color: var(--primary);
  background: none; border: none; cursor: pointer; padding: 0;
}
.section-link:active { opacity: .7; }

/* ── Deadlines ── */
.dl-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer; transition: background .12s;
}
.dl-row:active { background: var(--bg-secondary); }
.dl-row-last { border-bottom: none; }

.dl-emoji { font-size: 18px; flex-shrink: 0; line-height: 1; }
.dl-info  { flex: 1; min-width: 0; }
.dl-name  { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.dl-desc  { font-size: 12px; color: var(--text-secondary); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dl-badge {
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 20px;
  white-space: nowrap; flex-shrink: 0;
  background: var(--bg-secondary); color: var(--text-secondary);
}
.dl-badge.expiring { background: rgba(245,158,11,0.12); color: #b45309; }
.dl-badge.expired  { background: rgba(239,68,68,0.10);  color: #b91c1c; }
[data-theme="dark"] .dl-badge.expiring { background: rgba(245,158,11,0.15); color: #fcd34d; }
[data-theme="dark"] .dl-badge.expired  { background: rgba(239,68,68,0.12);  color: #fca5a5; }

/* ── Fuel rows ── */
.fuel-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer; transition: background .12s;
}
.fuel-row:active { background: var(--bg-secondary); }
.fuel-row-last { border-bottom: none; }

.fuel-date-box {
  width: 38px; height: 44px;
  background: var(--bg-secondary);
  border-radius: var(--r); border: 1px solid var(--border);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.fuel-day   { font-size: 16px; font-weight: 800; color: var(--text-primary); line-height: 1; }
.fuel-month { font-size: 9px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.3px; margin-top: 1px; }

.fuel-info { flex: 1; min-width: 0; }
.fuel-main { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.fuel-sub  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.fuel-chevron { width: 14px; height: 14px; color: var(--text-tertiary); flex-shrink: 0; }

/* ── Prices strip ── */
.prices-strip {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  display: flex; overflow: hidden;
  cursor: pointer; box-shadow: var(--shadow-sm);
  transition: opacity .15s;
}
.prices-strip:active { opacity: .85; }

.prices-item {
  flex: 1; padding: 14px 12px;
  border-right: 1px solid var(--border);
}
.prices-item:last-child { border-right: none; }

.prices-nome {
  font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-tertiary); margin-bottom: 4px;
}
.prices-val {
  font-size: 17px; font-weight: 800;
  color: var(--primary); letter-spacing: -0.5px; line-height: 1.1;
}
.prices-val span { font-size: 10px; color: var(--text-tertiary); font-weight: 600; margin-left: 2px; }
.prices-media { font-size: 10px; color: var(--text-secondary); margin-top: 3px; }
</style>
