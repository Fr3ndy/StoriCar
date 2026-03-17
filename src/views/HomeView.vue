<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useStatistics } from '../composables/useStatistics'

// Prezzi carburante widget
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

const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)
const defaultVehicleId = computed(() => data.value.settings?.defaultVehicleId)

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

function formatNumber(num, decimals = 2) {
  if (num == null || isNaN(num)) return '-'
  return num.toFixed(decimals).replace('.', ',')
}

function formatCurrency(num) {
  if (num == null || isNaN(num)) return '-'
  return formatNumber(num) + ' €'
}

const upcomingDeadlines = computed(() => {
  if (!selectedVehicleId.value) return []
  return getDeadlinesByVehicle(selectedVehicleId.value).filter(dl => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(dl.expiryDate)
    const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    return days <= (dl.reminderDays || 30)
  })
})

const deadlineTypeLabels = {
  assicurazione: { label: 'Assicurazione', icon: '🛡️' },
  bollo: { label: 'Bollo', icon: '📄' },
  tagliando: { label: 'Tagliando', icon: '🔧' },
  revisione: { label: 'Revisione', icon: '🔍' },
  gomme: { label: 'Cambio Gomme', icon: '⚙️' },
  altro: { label: 'Altro', icon: '📌' }
}

function deadlineDays(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
}

function deadlineStatusClass(dl) {
  const days = deadlineDays(dl.expiryDate)
  if (days < 0) return 'expired'
  if (days <= (dl.reminderDays || 30)) return 'expiring'
  return 'ok'
}

function deadlineStatusLabel(dl) {
  const days = deadlineDays(dl.expiryDate)
  if (days < 0) return `Scaduta da ${Math.abs(days)} gg`
  if (days === 0) return 'Scade oggi!'
  return `Scade in ${days} gg`
}
</script>

<template>
  <div class="home">
    <!-- No vehicles state -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21l-7-4-7 4V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
      </svg>
      <h2>Benvenuto!</h2>
      <p>Inizia aggiungendo il tuo primo veicolo</p>
      <button class="btn btn-primary mt-16" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <!-- Dashboard -->
    <div v-else>

      <!-- Hero card: vehicle info + odometer -->
      <div class="hero-card">
        <div class="hero-top">
          <div class="hero-vehicle-info">
            <div class="hero-vehicle-name">{{ stats.vehicle.value?.name || 'Veicolo' }}</div>
            <div class="hero-vehicle-sub">
              {{ [stats.vehicle.value?.brand, stats.vehicle.value?.model, stats.vehicle.value?.year].filter(Boolean).join(' ') }}
              <span v-if="stats.vehicle.value?.plate"> · {{ stats.vehicle.value.plate }}</span>
            </div>
          </div>
          <div class="hero-vehicle-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4" />
            </svg>
          </div>
        </div>

        <div class="hero-odometer">
          <span class="hero-odo-value">{{ stats.lastOdometer.value > 0 ? stats.lastOdometer.value.toLocaleString('it-IT') : '—' }}</span>
          <span class="hero-odo-unit">km odometro</span>
        </div>

        <!-- Invisible select overlay for vehicle switching -->
        <select class="hero-select-overlay" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Prezzi carburante widget -->
      <div v-if="prezziWidget.length" class="fuel-prices-widget" @click="router.push('/fuel-prices')">
        <div class="fpw-header">
          <div class="fpw-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Prezzi area Cagliari
          </div>
          <span class="fpw-link">Vedi mappa →</span>
        </div>
        <div class="fpw-row">
          <div v-for="p in prezziWidget" :key="p.nome" class="fpw-item">
            <div class="fpw-nome">{{ p.nome }}</div>
            <div class="fpw-min">{{ p.min.toFixed(3).replace('.', ',') }} <span>€/L</span></div>
            <div class="fpw-media">media {{ p.media.toFixed(3).replace('.', ',') }}</div>
          </div>
        </div>
      </div>

      <!-- Quick actions: 3 buttons side by side -->
      <div class="quick-actions-row">
        <button class="quick-action-btn primary" @click="router.push('/fuel/add')">
          <div class="qa-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span>Rifornimento</span>
        </button>
        <button class="quick-action-btn" @click="router.push('/expenses/add')">
          <div class="qa-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <span>Spesa</span>
        </button>
        <button class="quick-action-btn" @click="router.push('/map')">
          <div class="qa-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span>Mappa</span>
        </button>
      </div>

      <!-- Stat grid 2x2 -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="stat-value">{{ formatNumber(stats.formattedConsumption.value.value) }}</div>
          <div class="stat-label">{{ stats.formattedConsumption.value.unit }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-amber">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="stat-value">{{ formatCurrency(stats.totalFuelSpent.value) }}</div>
          <div class="stat-label">Speso Carb.</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div class="stat-value">{{ formatNumber(stats.totalKmDriven.value, 0) }}</div>
          <div class="stat-label">Km Percorsi</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="stat-value">{{ formatCurrency(stats.totalSpent.value) }}</div>
          <div class="stat-label">Spesa Totale</div>
        </div>
      </div>

      <!-- Upcoming deadlines -->
      <div v-if="upcomingDeadlines.length > 0" class="card mt-16 deadlines-card">
        <div class="card-header">
          <h3 class="card-title">⚠️ Scadenze imminenti</h3>
          <button class="btn btn-sm btn-secondary" @click="router.push('/deadlines')">Vedi tutte</button>
        </div>
        <div
          v-for="dl in upcomingDeadlines"
          :key="dl.id"
          class="deadline-row"
          :class="deadlineStatusClass(dl)"
          @click="router.push('/deadlines')"
        >
          <span class="deadline-icon-small">{{ deadlineTypeLabels[dl.type]?.icon || '📌' }}</span>
          <div class="deadline-row-content">
            <span class="deadline-row-label">{{ deadlineTypeLabels[dl.type]?.label || dl.type }}</span>
            <span v-if="dl.description" class="deadline-row-desc"> – {{ dl.description }}</span>
          </div>
          <span class="deadline-row-status" :class="deadlineStatusClass(dl)">{{ deadlineStatusLabel(dl) }}</span>
        </div>
      </div>

      <!-- Recent fuel records -->
      <div class="card mt-16">
        <div class="card-header" style="margin-bottom:12px;">
          <h3 class="card-title">Ultimi rifornimenti</h3>
          <button class="btn btn-sm btn-secondary" @click="router.push('/fuel')">Vedi tutti</button>
        </div>
        <div v-if="stats.fuelRecords.value.length === 0" class="empty-section">
          <p>Nessun rifornimento registrato</p>
        </div>
        <div v-else>
          <div
            v-for="record in stats.fuelRecords.value.slice(0, 3)"
            :key="record.id"
            class="recent-item"
            @click="router.push(`/fuel/edit/${record.id}`)"
          >
            <div class="recent-date">{{ new Date(record.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) }}</div>
            <div class="recent-item-content">
              <div class="recent-item-main">{{ formatCurrency(record.amount) }} · {{ formatNumber(record.liters) }} L</div>
              <div class="recent-item-sub">{{ formatNumber(record.pricePerLiter, 3) }} €/L<span v-if="record.kmDriven"> · {{ Math.round(record.kmDriven) }} km</span></div>
            </div>
            <svg class="recent-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Summary card -->
      <div class="card mt-16">
        <h3 class="card-title" style="margin-bottom:12px;">Riepilogo consumi</h3>
        <div class="list-item">
          <span>Costo per km</span>
          <strong>{{ formatNumber(stats.costPerKm.value, 3) }} €/km</strong>
        </div>
        <div class="list-item">
          <span>Prezzo medio carburante</span>
          <strong>{{ formatNumber(stats.averagePricePerLiter.value, 3) }} €/L</strong>
        </div>
        <div class="list-item">
          <span>Spesa media mensile</span>
          <strong>{{ formatCurrency(stats.averageFuelSpentPerMonth.value) }}</strong>
        </div>
        <div class="list-item">
          <span>Totale litri</span>
          <strong>{{ formatNumber(stats.totalLiters.value) }} L</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Fuel prices widget */
.fuel-prices-widget {
  background: linear-gradient(135deg, #0f172a, #1e3a5f);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 14px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.fuel-prices-widget:active { opacity: 0.85; }
.fpw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.fpw-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.fpw-title svg { width: 14px; height: 14px; color: #60a5fa; }
.fpw-link { font-size: 11px; color: #60a5fa; font-weight: 600; }
.fpw-row { display: flex; gap: 8px; }
.fpw-item {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 8px 10px;
}
.fpw-nome { font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
.fpw-min { font-size: 18px; font-weight: 800; color: #86efac; letter-spacing: -0.5px; line-height: 1.1; }
.fpw-min span { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.5); }
.fpw-media { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px; }

/* Hero card */
.hero-card {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  color: white;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3);
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.hero-vehicle-name {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.hero-vehicle-sub {
  font-size: 13px;
  opacity: 0.75;
  margin-top: 3px;
}

.hero-vehicle-icon {
  width: 44px;
  height: 44px;
  background: rgba(255,255,255,0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-vehicle-icon svg {
  width: 24px;
  height: 24px;
}

.hero-odometer {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hero-odo-value {
  font-size: 38px;
  font-weight: 900;
  letter-spacing: -1.5px;
  line-height: 1;
}

.hero-odo-unit {
  font-size: 14px;
  opacity: 0.7;
}

.hero-select-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  font-size: 16px;
}

/* Quick actions */
.quick-actions-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.quick-action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: 16px;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 8px var(--shadow);
}

.quick-action-btn:active {
  transform: scale(0.95);
}

.quick-action-btn.primary {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
}

.qa-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qa-icon svg {
  width: 22px;
  height: 22px;
}

/* Stat icons */
.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.stat-icon svg {
  width: 18px;
  height: 18px;
}

.stat-icon-primary { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
.stat-icon-amber   { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
.stat-icon-green   { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.stat-icon-red     { background: rgba(239, 68, 68, 0.12);  color: #ef4444; }

/* Recent items */
.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-date {
  font-size: 12px;
  color: #2563eb;
  font-weight: 700;
  background: rgba(37, 99, 235, 0.1);
  padding: 4px 8px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.recent-item-content {
  flex: 1;
}

.recent-item-main {
  font-size: 14px;
  font-weight: 600;
}

.recent-item-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.recent-arrow {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.empty-section {
  text-align: center;
  padding: 20px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Deadlines */
.deadlines-card .card-header { margin-bottom: 8px; }

.deadline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.deadline-row:last-child { border-bottom: none; }

.deadline-icon-small { font-size: 18px; flex-shrink: 0; }

.deadline-row-content { flex: 1; font-size: 14px; }
.deadline-row-label { font-weight: 500; }
.deadline-row-desc { color: var(--text-secondary); }

.deadline-row-status {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.deadline-row-status.expiring { background: #fef3c7; color: #b45309; }
.deadline-row-status.expired  { background: #fee2e2; color: #b91c1c; }

[data-theme="dark"] .deadline-row-status.expiring { background: #451a03; color: #fcd34d; }
[data-theme="dark"] .deadline-row-status.expired  { background: #450a0a; color: #fca5a5; }
</style>
