<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useStatistics } from '../composables/useStatistics'

// Fuel prices widget
const fuelPricesData = ref(null)
onMounted(async () => {
  try {
    const res = await fetch(import.meta.env.VITE_FUEL_PRICES_URL || './fuel-prices.php')
    if (res.ok) {
      const json = await res.json()
      if (json.ok) fuelPricesData.value = json
    }
  } catch {}
})
const prezziWidget = computed(() => {
  if (!fuelPricesData.value?.stats) return []
  return Object.entries(fuelPricesData.value.stats)
    .filter(([, s]) => s?.self?.min != null)
    .map(([nome, s]) => ({ nome, min: s.self.min, media: s.self.media }))
    .slice(0, 3)
})

const router = useRouter()
const { data, dataReady, getDefaultVehicleId, setDefaultVehicle, getDeadlinesByVehicle } = useStorage()

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
  return fmt(num) + ' €'
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
  if (d < 0) return `Scaduta da ${Math.abs(d)} gg`
  if (d === 0) return 'Scade oggi!'
  return `${d} gg`
}
</script>

<template>
  <div>

    <!-- ── Empty state ── -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
      </svg>
      <h2>Benvenuto in Storicar!</h2>
      <p>Aggiungi il tuo primo veicolo per iniziare a tracciare le spese</p>
      <button class="btn btn-primary btn-block" style="margin-top:20px;max-width:240px" @click="router.push('/vehicles')">
        Aggiungi veicolo
      </button>
    </div>

    <!-- ── Dashboard ── -->
    <div v-else>

      <!-- Hero card -->
      <div class="hero-card">
        <div class="hero-top">
          <div>
            <div class="hero-name">{{ stats.vehicle.value?.name || 'Veicolo' }}</div>
            <div class="hero-sub">
              {{ [stats.vehicle.value?.brand, stats.vehicle.value?.model, stats.vehicle.value?.year].filter(Boolean).join(' ') }}
              <span v-if="stats.vehicle.value?.plate"> · {{ stats.vehicle.value.plate }}</span>
            </div>
          </div>
          <div class="hero-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
            </svg>
          </div>
        </div>
        <div class="hero-odo">
          <span class="hero-odo-value">{{ stats.lastOdometer.value > 0 ? stats.lastOdometer.value.toLocaleString('it-IT') : '—' }}</span>
          <span class="hero-odo-unit">km</span>
        </div>
        <!-- Invisible select per cambio veicolo -->
        <select class="hero-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Fuel prices widget -->
      <div v-if="prezziWidget.length" class="prices-widget" @click="router.push('/fuel-prices')">
        <div class="prices-header">
          <div class="prices-label">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Prezzi area Cagliari
          </div>
          <span class="prices-link">Vedi mappa →</span>
        </div>
        <div class="prices-row">
          <div v-for="p in prezziWidget" :key="p.nome" class="prices-item">
            <div class="prices-nome">{{ p.nome }}</div>
            <div class="prices-val">{{ p.min.toFixed(3).replace('.', ',') }}<span> €/L</span></div>
            <div class="prices-media">media {{ p.media.toFixed(3).replace('.', ',') }}</div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="quick-row">
        <button class="quick-btn primary" @click="router.push('/fuel/add')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Rifornimento
        </button>
        <button class="quick-btn" @click="router.push('/expenses/add')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Spesa
        </button>
        <button class="quick-btn" @click="router.push('/map')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Mappa
        </button>
      </div>

      <!-- Stats 2×2 -->
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
          <div class="stat-label">Speso Carb.</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmt(stats.totalKmDriven.value, 0) }}</div>
          <div class="stat-label">Km Percorsi</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="stat-value">{{ fmtCur(stats.totalSpent.value) }}</div>
          <div class="stat-label">Totale</div>
        </div>
      </div>

      <!-- Scadenze imminenti -->
      <div v-if="upcomingDeadlines.length > 0" class="card">
        <div class="card-header">
          <h3 class="card-title">⚠️ Scadenze</h3>
          <button class="btn btn-sm btn-secondary" @click="router.push('/deadlines')">Vedi tutte</button>
        </div>
        <div
          v-for="dl in upcomingDeadlines"
          :key="dl.id"
          class="dl-row"
          @click="router.push('/deadlines')"
        >
          <span class="dl-icon">{{ dlLabels[dl.type]?.icon || '📌' }}</span>
          <div class="dl-content">
            <span class="dl-label">{{ dlLabels[dl.type]?.label || dl.type }}</span>
            <span v-if="dl.description" class="dl-desc"> — {{ dl.description }}</span>
          </div>
          <span class="dl-badge" :class="dlStatus(dl)">{{ dlLabel(dl) }}</span>
        </div>
      </div>

      <!-- Ultimi rifornimenti -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Ultimi rifornimenti</h3>
          <button class="btn btn-sm btn-secondary" @click="router.push('/fuel')">Vedi tutti</button>
        </div>
        <div v-if="stats.fuelRecords.value.length === 0" class="empty-section">
          Nessun rifornimento registrato
        </div>
        <div
          v-for="r in stats.fuelRecords.value.slice(0, 3)"
          :key="r.id"
          class="fuel-row"
          @click="router.push(`/fuel/edit/${r.id}`)"
        >
          <div class="fuel-date">{{ new Date(r.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) }}</div>
          <div class="fuel-content">
            <div class="fuel-main">{{ fmtCur(r.amount) }} · {{ fmt(r.liters) }} L</div>
            <div class="fuel-sub">{{ fmt(r.pricePerLiter, 3) }} €/L<span v-if="r.kmDriven"> · {{ Math.round(r.kmDriven) }} km</span></div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px;color:var(--text-secondary);flex-shrink:0">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>

      <!-- Riepilogo consumi -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:12px">Riepilogo consumi</h3>
        <div class="list-item">
          <span>Costo per km</span>
          <strong>{{ fmt(stats.costPerKm.value, 3) }} €/km</strong>
        </div>
        <div class="list-item">
          <span>Prezzo medio carburante</span>
          <strong>{{ fmt(stats.averagePricePerLiter.value, 3) }} €/L</strong>
        </div>
        <div class="list-item">
          <span>Spesa media mensile</span>
          <strong>{{ fmtCur(stats.averageFuelSpentPerMonth.value) }}</strong>
        </div>
        <div class="list-item">
          <span>Totale litri</span>
          <strong>{{ fmt(stats.totalLiters.value) }} L</strong>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Hero card ── */
.hero-card {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  color: white;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(37,99,235,0.3);
}
[data-theme="dark"] .hero-card {
  background: linear-gradient(135deg, #0f2456, #1d3a8a);
}

.hero-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }

.hero-name { font-size: 20px; font-weight: 800; line-height: 1.2; }
.hero-sub  { font-size: 13px; opacity: .75; margin-top: 3px; }

.hero-icon {
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.15);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.hero-icon svg { width: 24px; height: 24px; }

.hero-odo { display: flex; align-items: baseline; gap: 6px; }
.hero-odo-value { font-size: 38px; font-weight: 900; letter-spacing: -1.5px; line-height: 1; }
.hero-odo-unit  { font-size: 16px; opacity: .7; font-weight: 600; }

.hero-select { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; font-size: 16px; }

/* ── Fuel prices widget ── */
.prices-widget {
  background: linear-gradient(135deg, #0f172a, #1e3a5f);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: opacity .15s;
}
.prices-widget:active { opacity: .85; }

.prices-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.prices-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,.6);
  text-transform: uppercase; letter-spacing: .5px;
}
.prices-label svg { width: 13px; height: 13px; color: #60a5fa; }
.prices-link { font-size: 11px; color: #60a5fa; font-weight: 600; }

.prices-row { display: flex; gap: 8px; }
.prices-item { flex: 1; background: rgba(255,255,255,.07); border-radius: 10px; padding: 8px 10px; }
.prices-nome { font-size: 9px; color: rgba(255,255,255,.45); font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
.prices-val  { font-size: 18px; font-weight: 800; color: #86efac; letter-spacing: -.5px; line-height: 1.1; }
.prices-val span { font-size: 10px; color: rgba(255,255,255,.4); font-weight: 600; }
.prices-media { font-size: 10px; color: rgba(255,255,255,.35); margin-top: 2px; }

/* ── Quick actions ── */
.quick-row { display: flex; gap: 10px; margin-bottom: 12px; }

.quick-btn {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 14px 8px;
  border-radius: 14px;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px; font-weight: 600;
  cursor: pointer;
  transition: all .15s;
  box-shadow: 0 1px 4px var(--shadow);
}
.quick-btn svg { width: 22px; height: 22px; }
.quick-btn:active { transform: scale(.95); }
.quick-btn:hover { border-color: var(--primary); color: var(--primary); }

.quick-btn.primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: white; border-color: transparent;
  box-shadow: 0 3px 12px rgba(37,99,235,.35);
}
.quick-btn.primary:hover { box-shadow: 0 4px 16px rgba(37,99,235,.45); }

/* ── Deadlines ── */
.dl-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.dl-row:last-child { border-bottom: none; }
.dl-icon { font-size: 18px; flex-shrink: 0; }
.dl-content { flex: 1; font-size: 14px; }
.dl-label { font-weight: 500; }
.dl-desc  { color: var(--text-secondary); font-size: 13px; }
.dl-badge {
  font-size: 11px; font-weight: 700;
  padding: 3px 8px; border-radius: 8px;
  white-space: nowrap;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.dl-badge.expiring { background: #fef3c7; color: #b45309; }
.dl-badge.expired  { background: #fee2e2; color: #b91c1c; }
[data-theme="dark"] .dl-badge.expiring { background: #451a03; color: #fcd34d; }
[data-theme="dark"] .dl-badge.expired  { background: #450a0a; color: #fca5a5; }

/* ── Fuel rows ── */
.fuel-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.fuel-row:last-child { border-bottom: none; }

.fuel-date {
  font-size: 11px; font-weight: 700; color: var(--primary);
  background: var(--primary-glow);
  padding: 4px 8px; border-radius: 8px;
  white-space: nowrap; flex-shrink: 0;
}
.fuel-content { flex: 1; }
.fuel-main { font-size: 14px; font-weight: 600; }
.fuel-sub  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* ── Empty section ── */
.empty-section {
  text-align: center; padding: 20px 0;
  color: var(--text-secondary); font-size: 14px;
}
</style>
