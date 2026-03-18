<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useStatistics } from '../composables/useStatistics'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
)

const router = useRouter()
const { data, dataReady, getDefaultVehicleId, setDefaultVehicle } = useStorage()

const selectedVehicleId = ref(null)
const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)
const defaultVehicleId = computed(() => data.value.settings?.defaultVehicleId)

// Period filter
const filterFrom = ref('')
const filterTo = ref('')
const activeFilter = ref('all') // 'all', 'year', 'month', '6m', 'custom'

const filters = computed(() => ({
  from: filterFrom.value || null,
  to: filterTo.value || null
}))

const stats = useStatistics(selectedVehicleId, filters)

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

function setQuickFilter(type) {
  activeFilter.value = type
  const now = new Date()
  if (type === 'all') {
    filterFrom.value = ''
    filterTo.value = ''
  } else if (type === 'year') {
    filterFrom.value = `${now.getFullYear()}-01-01`
    filterTo.value = now.toISOString().slice(0, 10)
  } else if (type === '6m') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 6)
    filterFrom.value = from.toISOString().slice(0, 10)
    filterTo.value = now.toISOString().slice(0, 10)
  } else if (type === 'month') {
    filterFrom.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    filterTo.value = now.toISOString().slice(0, 10)
  }
}

function fmt(num, dec = 2) {
  if (num == null || isNaN(num)) return '-'
  return num.toFixed(dec).replace('.', ',')
}
function fmtEur(num) {
  if (num == null || isNaN(num)) return '-'
  return fmt(num) + ' €'
}
function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
}

// Chart theme
const isDark = computed(() => data.value.settings.theme === 'dark')
const C = computed(() => ({
  text:    isDark.value ? '#94a3b8' : '#475569',
  grid:    isDark.value ? '#1e2d47' : '#dbeafe',
  primary: '#2563eb',
  blue2:   '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#ef4444',
  purple:  '#8b5cf6',
  cyan:    '#0ea5e9'
}))

const consumptionLabel = computed(() =>
  stats.consumptionUnit.value === 'L100km' ? 'L/100km' : 'km/L'
)

// ── Computed extras ──
const totalEffectiveKm = computed(() =>
  stats.effectiveKmRecords.value.reduce((s, r) => s + (r.effectiveKm || 0), 0)
)

const bestFuelRecord = computed(() => {
  const valid = stats.effectiveKmRecords.value.filter(r => r.effectiveKm > 0 && r.liters)
  if (!valid.length) return null
  return valid.reduce((best, r) => {
    const v = stats.consumptionUnit.value === 'L100km' ? (r.liters / r.effectiveKm) * 100 : r.effectiveKm / r.liters
    const b = stats.consumptionUnit.value === 'L100km' ? (best.liters / best.effectiveKm) * 100 : best.effectiveKm / best.liters
    return stats.consumptionUnit.value === 'L100km' ? (v < b ? r : best) : (v > b ? r : best)
  })
})

const worstFuelRecord = computed(() => {
  const valid = stats.effectiveKmRecords.value.filter(r => r.effectiveKm > 0 && r.liters)
  if (!valid.length) return null
  return valid.reduce((worst, r) => {
    const v = stats.consumptionUnit.value === 'L100km' ? (r.liters / r.effectiveKm) * 100 : r.effectiveKm / r.liters
    const w = stats.consumptionUnit.value === 'L100km' ? (worst.liters / worst.effectiveKm) * 100 : worst.effectiveKm / worst.liters
    return stats.consumptionUnit.value === 'L100km' ? (v > w ? r : worst) : (v < w ? r : worst)
  })
})

function recordConsumption(r) {
  if (!r?.effectiveKm || !r.liters) return 0
  return stats.consumptionUnit.value === 'L100km' ? (r.liters / r.effectiveKm) * 100 : r.effectiveKm / r.liters
}

const minPrice = computed(() => {
  const p = stats.fuelRecords.value.map(r => r.pricePerLiter).filter(Boolean)
  return p.length ? Math.min(...p) : null
})
const maxPrice = computed(() => {
  const p = stats.fuelRecords.value.map(r => r.pricePerLiter).filter(Boolean)
  return p.length ? Math.max(...p) : null
})

const biggestExpense = computed(() => {
  if (!stats.expenses.value.length) return null
  return stats.expenses.value.reduce((max, e) => e.amount > max.amount ? e : max)
})

const currentYear = new Date().getFullYear()

const thisYearTotal = computed(() => stats.thisYearFuelSpent.value + stats.thisYearExpensesSpent.value)

const fuelByType = computed(() => {
  const map = {}
  stats.fuelRecords.value.forEach(r => {
    const t = r.fuelType || 'Altro'
    if (!map[t]) map[t] = { liters: 0, amount: 0, count: 0 }
    map[t].liters += r.liters || 0
    map[t].amount += r.amount || 0
    map[t].count++
  })
  return map
})

// ── Show/hide sezioni collassabili ──
const showDetailedList = ref(false)
const showYearComparison = ref(true)
const showSeasonalChart = ref(false)

// ── Charts ────────────────────────────────────────────────────────
const lineOpts = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: C.value.text, maxTicksLimit: 7, font: { size: 11 } }, grid: { color: C.value.grid } },
    y: { ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } }
  }
}))

const lineOptsWithTrend = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: C.value.text, font: { size: 11 } }, position: 'top' } },
  scales: {
    x: { ticks: { color: C.value.text, maxTicksLimit: 7, font: { size: 11 } }, grid: { color: C.value.grid } },
    y: { ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } }
  }
}))

const barOpts = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: C.value.text, font: { size: 11 } }, position: 'top' } },
  scales: {
    x: { stacked: true, ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } },
    y: { stacked: true, ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } }
  }
}))

const barOptsGrouped = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: C.value.text, font: { size: 11 } }, position: 'top' } },
  scales: {
    x: { ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } },
    y: { ticks: { color: C.value.text, font: { size: 11 } }, grid: { color: C.value.grid } }
  }
}))

const doughnutOpts = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { color: C.value.text, font: { size: 11 }, padding: 12 } } }
}))

const priceChartData = computed(() => ({
  labels: stats.fuelPriceHistory.value.map(p => { const d = new Date(p.date); return `${d.getDate()}/${d.getMonth()+1}` }),
  datasets: [{
    label: 'Prezzo €/L',
    data: stats.fuelPriceHistory.value.map(p => p.price),
    borderColor: C.value.primary, backgroundColor: C.value.primary + '25',
    fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5
  }]
}))

const consumptionTrendChartData = computed(() => ({
  labels: stats.consumptionTrend.value.map(c => { const d = new Date(c.date); return `${d.getDate()}/${d.getMonth()+1}` }),
  datasets: [
    {
      label: consumptionLabel.value,
      data: stats.consumptionTrend.value.map(c => c.consumption),
      borderColor: C.value.success + '88',
      backgroundColor: 'transparent',
      tension: 0.3, pointRadius: 2, borderDash: [4, 3]
    },
    {
      label: 'Media mobile',
      data: stats.consumptionTrend.value.map(c => c.trend),
      borderColor: C.value.success,
      backgroundColor: C.value.success + '20',
      fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5
    }
  ]
}))

const monthlyChartData = computed(() => ({
  labels: stats.monthlySpending.value.map(m => { const [y, mo] = m.month.split('-'); return `${mo}/${y.slice(2)}` }),
  datasets: [
    { label: 'Carburante', data: stats.monthlySpending.value.map(m => m.fuel), backgroundColor: C.value.primary },
    { label: 'Altre spese', data: stats.monthlySpending.value.map(m => m.other), backgroundColor: C.value.warning }
  ]
}))

const yearlyChartData = computed(() => ({
  labels: stats.yearlyComparison.value.map(y => String(y.year)),
  datasets: [
    { label: 'Carburante', data: stats.yearlyComparison.value.map(y => y.fuel), backgroundColor: C.value.primary },
    { label: 'Altre spese', data: stats.yearlyComparison.value.map(y => y.other), backgroundColor: C.value.warning }
  ]
}))

const seasonalChartData = computed(() => {
  const monthNames = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  return {
    labels: monthNames,
    datasets: [
      {
        label: 'Media carburante',
        data: stats.monthlyAverage.value.map(m => m.fuelAvg),
        backgroundColor: C.value.primary + 'cc'
      },
      {
        label: 'Media altre spese',
        data: stats.monthlyAverage.value.map(m => m.otherAvg),
        backgroundColor: C.value.warning + 'cc'
      }
    ]
  }
})

const categoryColors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#6b7280']
const categoryLabels = {
  maintenance: 'Manutenzione', insurance: 'Assicurazione', tax: 'Bollo',
  tires: 'Gomme', wash: 'Lavaggio', parking: 'Parcheggio',
  toll: 'Pedaggi', fine: 'Multe', other: 'Altro'
}

const categoryChartData = computed(() => {
  const cats = stats.expensesByCategory.value
  return {
    labels: Object.keys(cats).map(k => categoryLabels[k] || k),
    datasets: [{ data: Object.values(cats), backgroundColor: categoryColors.slice(0, Object.keys(cats).length) }]
  }
})

const dayOfWeekChartData = computed(() => ({
  labels: stats.refuelsByDayOfWeek.value.map(d => d.name),
  datasets: [{
    label: 'Rifornimenti',
    data: stats.refuelsByDayOfWeek.value.map(d => d.count),
    backgroundColor: stats.refuelsByDayOfWeek.value.map((_, i) =>
      i === 6 || i === 0 ? C.value.cyan + 'cc' : C.value.primary + 'cc'
    )
  }]
}))

const monthNames = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
</script>

<template>
  <div class="stats-view">

    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <div v-else>

      <!-- Vehicle selector -->
      <div style="margin-bottom:12px">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- ── FILTRO PERIODO ── -->
      <div class="period-filter">
        <div class="filter-chips">
          <button class="chip" :class="{ active: activeFilter === 'all' }" @click="setQuickFilter('all')">Tutto</button>
          <button class="chip" :class="{ active: activeFilter === 'year' }" @click="setQuickFilter('year')">{{ currentYear }}</button>
          <button class="chip" :class="{ active: activeFilter === '6m' }" @click="setQuickFilter('6m')">6 mesi</button>
          <button class="chip" :class="{ active: activeFilter === 'month' }" @click="setQuickFilter('month')">Mese</button>
          <button class="chip" :class="{ active: activeFilter === 'custom' }" @click="activeFilter = 'custom'">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:13px;height:13px;vertical-align:-2px">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Periodo
          </button>
        </div>
        <div v-if="activeFilter === 'custom'" class="date-range">
          <input type="date" class="form-input date-input" v-model="filterFrom" />
          <span class="date-sep">→</span>
          <input type="date" class="form-input date-input" v-model="filterTo" />
        </div>
        <div v-if="filters.from || filters.to" class="filter-active-badge">
          Filtro attivo: {{ filters.from ? fmtDate(filters.from) : '...' }} → {{ filters.to ? fmtDate(filters.to) : '...' }}
        </div>
      </div>

      <!-- ── HERO ── -->
      <div class="hero-grid">
        <div class="hero-card hero-blue">
          <div class="hero-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="hero-value">{{ fmtEur(stats.totalSpent.value) }}</div>
          <div class="hero-label">Spesa totale</div>
        </div>
        <div class="hero-card hero-sky">
          <div class="hero-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div class="hero-value">{{ fmt(totalEffectiveKm, 0) }}</div>
          <div class="hero-label">Km percorsi</div>
        </div>
        <div class="hero-card hero-green">
          <div class="hero-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="hero-value">{{ fmt(stats.formattedConsumption.value.value) }}</div>
          <div class="hero-label">{{ stats.formattedConsumption.value.unit }}</div>
        </div>
        <div class="hero-card hero-amber">
          <div class="hero-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="hero-value">{{ fmt(stats.totalCostPerKm.value, 3) }}</div>
          <div class="hero-label">€/km</div>
        </div>
      </div>

      <!-- ── SEZIONE: Anno corrente ── -->
      <div class="section" v-if="activeFilter === 'all'">
        <div class="section-header">
          <div class="section-icon section-icon-purple">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 class="section-title">Anno {{ currentYear }}</h2>
        </div>

        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-val">{{ fmtEur(thisYearTotal) }}</div>
            <div class="kpi-lbl">Totale</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ fmtEur(stats.thisYearFuelSpent.value) }}</div>
            <div class="kpi-lbl">Carburante</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ fmtEur(stats.thisYearExpensesSpent.value) }}</div>
            <div class="kpi-lbl">Spese</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-val">{{ fmt(stats.thisYearLiters.value) }}</div>
            <div class="kpi-lbl">Litri</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ stats.thisYearRefuels.value }}</div>
            <div class="kpi-lbl">Rifornimenti</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ stats.thisYearRefuels.value ? fmtEur(stats.thisYearFuelSpent.value / stats.thisYearRefuels.value) : '-' }}</div>
            <div class="kpi-lbl">Media/riforn.</div>
          </div>
        </div>

        <!-- Split bar -->
        <div v-if="thisYearTotal > 0" class="split-wrap">
          <div class="split-bar">
            <div class="split-fuel" :style="{ width: ((stats.thisYearFuelSpent.value / thisYearTotal) * 100) + '%' }"></div>
            <div class="split-other" :style="{ width: ((stats.thisYearExpensesSpent.value / thisYearTotal) * 100) + '%' }"></div>
          </div>
          <div class="split-legend">
            <span><span class="dot dot-blue"></span>Carb. {{ fmt((stats.thisYearFuelSpent.value / thisYearTotal) * 100, 0) }}%</span>
            <span><span class="dot dot-amber"></span>Spese {{ fmt((stats.thisYearExpensesSpent.value / thisYearTotal) * 100, 0) }}%</span>
          </div>
        </div>

        <!-- Dettaglio mesi anno corrente -->
        <div class="card" v-if="stats.monthlySpending.value.some(m => m.month.startsWith(currentYear.toString()))">
          <div
            v-for="m in stats.monthlySpending.value.filter(m => m.month.startsWith(currentYear.toString())).reverse()"
            :key="m.month"
            class="row-item"
          >
            <span class="row-left">{{ monthNames[parseInt(m.month.split('-')[1]) - 1] }}</span>
            <div class="row-right">
              <span class="badge-blue">{{ fmtEur(m.fuel) }}</span>
              <span v-if="m.other > 0" class="badge-amber">{{ fmtEur(m.other) }}</span>
              <strong>{{ fmtEur(m.total) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Previsioni ── -->
      <div class="section" v-if="stats.monthlyForecast.value">
        <div class="section-header">
          <div class="section-icon section-icon-cyan">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h2 class="section-title">Previsioni</h2>
        </div>

        <div class="forecast-banner">
          <div class="forecast-item">
            <div class="forecast-label">Spesa mensile stimata</div>
            <div class="forecast-value">{{ fmtEur(stats.monthlyForecast.value.total) }}</div>
            <div class="forecast-sub">Media ultimi {{ stats.monthlyForecast.value.basedOn }} mesi</div>
          </div>
          <div class="forecast-divider"></div>
          <div class="forecast-item">
            <div class="forecast-label">Spesa annua stimata</div>
            <div class="forecast-value">{{ fmtEur(stats.annualForecast.value?.total) }}</div>
            <div class="forecast-sub">Proiezione 12 mesi</div>
          </div>
        </div>

        <div class="card">
          <div class="row-item">
            <span class="row-left">Carburante/mese</span>
            <strong>{{ fmtEur(stats.monthlyForecast.value.fuel) }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Altre spese/mese</span>
            <strong>{{ fmtEur(stats.monthlyForecast.value.other) }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Carburante/anno</span>
            <strong>{{ fmtEur(stats.annualForecast.value?.fuel) }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Altre spese/anno</span>
            <strong>{{ fmtEur(stats.annualForecast.value?.other) }}</strong>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Confronto anni ── -->
      <div class="section" v-if="stats.yearlyComparison.value.length > 1">
        <div class="section-header" @click="showYearComparison = !showYearComparison" style="cursor:pointer">
          <div class="section-icon section-icon-blue">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 class="section-title">Confronto anni</h2>
          <svg class="collapse-arrow" :class="{ rotated: !showYearComparison }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div v-if="showYearComparison">
          <div class="chart-card">
            <div class="chart-label">Spese per anno</div>
            <div class="chart-wrap">
              <Bar :data="yearlyChartData" :options="barOpts" />
            </div>
          </div>

          <div class="card">
            <div class="year-table-header row-item" style="font-size:11px;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.4px">
              <span>Anno</span>
              <div class="row-right" style="gap:12px">
                <span>Carb.</span>
                <span>Spese</span>
                <span>Totale</span>
              </div>
            </div>
            <div v-for="y in stats.yearlyComparison.value.slice().reverse()" :key="y.year" class="row-item">
              <span class="row-left">
                <strong>{{ y.year }}</strong>
                <span class="muted">{{ y.refuels }} riforn. · {{ fmt(y.liters) }} L</span>
              </span>
              <div class="row-right" style="gap:12px">
                <span class="badge-blue">{{ fmtEur(y.fuel) }}</span>
                <span class="badge-amber">{{ fmtEur(y.other) }}</span>
                <strong>{{ fmtEur(y.total) }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Spese mensili (chart) ── -->
      <div class="section" v-if="stats.monthlySpending.value.length > 1">
        <div class="section-header">
          <div class="section-icon section-icon-blue">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 class="section-title">Spese mensili</h2>
        </div>
        <div class="chart-wrap">
          <Bar :data="monthlyChartData" :options="barOpts" />
        </div>
      </div>

      <!-- ── SEZIONE: Distribuzione stagionale ── -->
      <div class="section" v-if="stats.monthlyAverage.value.some(m => m.fuel > 0 || m.other > 0)">
        <div class="section-header" @click="showSeasonalChart = !showSeasonalChart" style="cursor:pointer">
          <div class="section-icon section-icon-purple">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h2 class="section-title">Distribuzione stagionale</h2>
          <svg class="collapse-arrow" :class="{ rotated: !showSeasonalChart }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div v-if="showSeasonalChart">
          <div class="chart-card">
            <div class="chart-label">Media mensile per tipo</div>
            <div class="chart-wrap">
              <Bar :data="seasonalChartData" :options="barOptsGrouped" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Carburante ── -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-amber">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 class="section-title">Carburante</h2>
        </div>

        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-val">{{ fmtEur(stats.totalFuelSpent.value) }}</div>
            <div class="kpi-lbl">Totale speso</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ fmt(stats.totalLiters.value) }}</div>
            <div class="kpi-lbl">Litri totali</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ stats.fuelRecords.value.length }}</div>
            <div class="kpi-lbl">Rifornimenti</div>
          </div>
        </div>

        <div class="card">
          <div class="row-item">
            <span class="row-left">Costo carburante/km</span>
            <strong>{{ fmt(stats.costPerKm.value, 3) }} €/km</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Costo totale/km</span>
            <strong>{{ fmt(stats.totalCostPerKm.value, 3) }} €/km</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Prezzo medio</span>
            <strong>{{ fmt(stats.averagePricePerLiter.value, 3) }} €/L</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Prezzo minimo</span>
            <strong class="text-success">{{ minPrice != null ? fmt(minPrice, 3) + ' €/L' : '-' }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Prezzo massimo</span>
            <strong class="text-danger">{{ maxPrice != null ? fmt(maxPrice, 3) + ' €/L' : '-' }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Spesa media/mese</span>
            <strong>{{ fmtEur(stats.averageFuelSpentPerMonth.value) }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Media per rifornimento</span>
            <strong>{{ stats.fuelRecords.value.length ? fmt(stats.totalLiters.value / stats.fuelRecords.value.length) + ' L' : '-' }}</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Km effettivi totali</span>
            <strong>{{ fmt(totalEffectiveKm, 0) }} km</strong>
          </div>
          <div class="row-item">
            <span class="row-left">Odometro attuale</span>
            <strong>{{ fmt(stats.lastOdometer.value, 0) }} km</strong>
          </div>
        </div>

        <!-- Trend efficienza -->
        <div class="card" v-if="stats.efficiencyTrend.value">
          <div class="card-section-title">Trend efficienza</div>
          <div class="efficiency-trend">
            <div class="trend-arrow" :class="stats.efficiencyTrend.value.improved ? 'trend-up' : 'trend-down'">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                  :d="stats.efficiencyTrend.value.improved ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'" />
              </svg>
            </div>
            <div class="trend-text">
              <strong :class="stats.efficiencyTrend.value.improved ? 'text-success' : 'text-danger'">
                {{ stats.efficiencyTrend.value.improved ? 'Migliorata' : 'Peggiorata' }}
              </strong>
              <span class="muted">di {{ fmt(stats.efficiencyTrend.value.diff) }} {{ consumptionLabel }} (prima metà vs seconda)</span>
            </div>
          </div>
        </div>

        <!-- Tipo carburante -->
        <div class="card" v-if="Object.keys(fuelByType).length">
          <div class="card-section-title">Per tipo carburante</div>
          <div v-for="(val, type) in fuelByType" :key="type" class="row-item">
            <span class="row-left" style="text-transform:capitalize;">
              {{ type }}
              <span class="muted">{{ val.count }} rifornimenti</span>
            </span>
            <div class="row-right">
              <span class="muted">{{ fmt(val.liters) }} L</span>
              <strong>{{ fmtEur(val.amount) }}</strong>
            </div>
          </div>
        </div>

        <!-- Record consumi -->
        <div class="card" v-if="bestFuelRecord">
          <div class="card-section-title">Record consumi</div>
          <div class="record-row best">
            <div class="record-badge badge-success">Miglior</div>
            <div class="record-info">
              <strong>{{ fmt(recordConsumption(bestFuelRecord)) }} {{ consumptionLabel }}</strong>
              <span class="muted">{{ fmtDate(bestFuelRecord?.date) }}</span>
            </div>
          </div>
          <div class="record-row worst">
            <div class="record-badge badge-danger">Peggior</div>
            <div class="record-info">
              <strong>{{ fmt(recordConsumption(worstFuelRecord)) }} {{ consumptionLabel }}</strong>
              <span class="muted">{{ fmtDate(worstFuelRecord?.date) }}</span>
            </div>
          </div>
        </div>

        <!-- Chart prezzo -->
        <div class="chart-card" v-if="stats.fuelPriceHistory.value.length > 1">
          <div class="chart-label">Andamento prezzo €/L</div>
          <div class="chart-wrap">
            <Line :data="priceChartData" :options="lineOpts" />
          </div>
        </div>

        <!-- Chart consumi con media mobile -->
        <div class="chart-card" v-if="stats.consumptionTrend.value.length > 1">
          <div class="chart-label">Andamento consumi ({{ consumptionLabel }})</div>
          <div class="chart-wrap">
            <Line :data="consumptionTrendChartData" :options="lineOptsWithTrend" />
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Lista rifornimenti dettagliata ── -->
      <div class="section" v-if="stats.detailedFuelList.value.length > 0">
        <div class="section-header" @click="showDetailedList = !showDetailedList" style="cursor:pointer">
          <div class="section-icon section-icon-blue">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 class="section-title">Dettaglio rifornimenti</h2>
          <svg class="collapse-arrow" :class="{ rotated: !showDetailedList }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div v-if="showDetailedList" class="card detail-list">
          <div class="detail-header">
            <span>Data</span>
            <span>Litri</span>
            <span>€/L</span>
            <span>{{ consumptionLabel }}</span>
            <span>€</span>
          </div>
          <div
            v-for="r in stats.detailedFuelList.value"
            :key="r.id"
            class="detail-row"
          >
            <span class="detail-date">{{ fmtDate(r.date) }}</span>
            <span>{{ fmt(r.liters) }}</span>
            <span class="muted">{{ r.pricePerLiter ? fmt(r.pricePerLiter, 3) : '-' }}</span>
            <span :class="r.computedConsumption ? 'detail-consumption' : 'muted'">
              {{ r.computedConsumption ? fmt(r.computedConsumption) : '-' }}
            </span>
            <strong>{{ fmtEur(r.amount) }}</strong>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Intervalli tra rifornimenti ── -->
      <div class="section" v-if="stats.refuelIntervals.value.length > 0">
        <div class="section-header">
          <div class="section-icon section-icon-green">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="section-title">Intervalli rifornimenti</h2>
        </div>

        <div class="interval-grid">
          <div class="interval-card">
            <div class="interval-val">{{ fmt(stats.avgDaysBetweenRefuels.value, 0) }}</div>
            <div class="interval-unit">giorni medi</div>
          </div>
          <div class="interval-card">
            <div class="interval-val">{{ fmt(stats.avgKmBetweenRefuels.value, 0) }}</div>
            <div class="interval-unit">km medi</div>
          </div>
        </div>

        <div class="card">
          <div class="row-item" v-if="stats.maxDaysBetweenRefuels.value">
            <div class="row-left">
              <span class="interval-label">Intervallo più lungo</span>
              <span class="muted small">{{ fmtDate(stats.maxDaysBetweenRefuels.value.fromDate) }} → {{ fmtDate(stats.maxDaysBetweenRefuels.value.toDate) }}</span>
            </div>
            <strong>{{ stats.maxDaysBetweenRefuels.value.days }} gg</strong>
          </div>
          <div class="row-item" v-if="stats.minDaysBetweenRefuels.value">
            <div class="row-left">
              <span class="interval-label">Intervallo più corto</span>
              <span class="muted small">{{ fmtDate(stats.minDaysBetweenRefuels.value.fromDate) }} → {{ fmtDate(stats.minDaysBetweenRefuels.value.toDate) }}</span>
            </div>
            <strong>{{ stats.minDaysBetweenRefuels.value.days }} gg</strong>
          </div>
        </div>

        <!-- Distribuzione per giorno settimana -->
        <div class="chart-card" v-if="stats.refuelsByDayOfWeek.value.some(d => d.count > 0)">
          <div class="chart-label">Rifornimenti per giorno</div>
          <div class="chart-wrap chart-wrap-sm">
            <Bar :data="dayOfWeekChartData" :options="{ ...barOptsGrouped, plugins: { legend: { display: false } } }" />
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Top stazioni ── -->
      <div class="section" v-if="stats.topStations.value.length > 1">
        <div class="section-header">
          <div class="section-icon section-icon-cyan">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 class="section-title">Top stazioni</h2>
        </div>

        <div class="card">
          <div v-for="(s, i) in stats.topStations.value" :key="s.name" class="row-item">
            <div class="row-left">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="rank-badge">{{ i + 1 }}</span>
                <span>{{ s.name }}</span>
              </div>
              <span class="muted">{{ s.count }} soste · {{ fmt(s.totalLiters) }} L</span>
            </div>
            <div class="row-right">
              <span class="muted">{{ fmt(s.avgPrice, 3) }} €/L</span>
              <strong>{{ fmtEur(s.totalAmount) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SEZIONE: Altre spese ── -->
      <div class="section">
        <div class="section-header">
          <div class="section-icon section-icon-red">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h2 class="section-title">Altre spese</h2>
        </div>

        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-val">{{ fmtEur(stats.totalOtherExpenses.value) }}</div>
            <div class="kpi-lbl">Totale</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ stats.expenses.value.length }}</div>
            <div class="kpi-lbl">Numero</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val">{{ stats.expenses.value.length ? fmtEur(stats.totalOtherExpenses.value / stats.expenses.value.length) : '-' }}</div>
            <div class="kpi-lbl">Media</div>
          </div>
        </div>

        <div class="card" v-if="biggestExpense">
          <div class="row-item">
            <div class="row-left">
              <span>Spesa più alta</span>
              <span class="muted small">{{ categoryLabels[biggestExpense.category] || biggestExpense.category }} · {{ fmtDate(biggestExpense.date) }}</span>
            </div>
            <strong class="text-danger">{{ fmtEur(biggestExpense.amount) }}</strong>
          </div>
        </div>

        <div v-if="Object.keys(stats.expensesByCategory.value).length > 0">
          <div class="chart-card">
            <div class="chart-label">Spese per categoria</div>
            <div class="chart-wrap chart-wrap-doughnut">
              <Doughnut :data="categoryChartData" :options="doughnutOpts" />
            </div>
          </div>

          <div class="card">
            <div v-for="(amount, category) in stats.expensesByCategory.value" :key="category" class="row-item">
              <div class="cat-dot-row">
                <span class="cat-dot" :style="{ background: categoryColors[Object.keys(stats.expensesByCategory.value).indexOf(category)] }"></span>
                <span>{{ categoryLabels[category] || category }}</span>
              </div>
              <div class="row-right">
                <span class="muted">{{ fmt((amount / stats.totalOtherExpenses.value) * 100, 0) }}%</span>
                <strong>{{ fmtEur(amount) }}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-section" v-if="!stats.expenses.value.length">
          <p>Nessuna spesa registrata</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.stats-view {
  padding: 16px;
  padding-bottom: 100px;
}

/* ── Period filter ── */
.period-filter {
  margin-bottom: 16px;
}

.filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.18s;
}

.chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.date-input {
  flex: 1;
  font-size: 13px;
  padding: 8px 10px;
}

.date-sep {
  color: var(--text-secondary);
  font-weight: 700;
  flex-shrink: 0;
}

.filter-active-badge {
  font-size: 12px;
  color: var(--primary);
  background: var(--primary-glow);
  padding: 4px 10px;
  border-radius: 6px;
  margin-top: 6px;
  display: inline-block;
  font-weight: 600;
}

/* ── Hero grid ── */
.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.hero-card {
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
}

.hero-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.hero-icon svg { width: 18px; height: 18px; color: white; }

.hero-value {
  font-size: 20px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.5px;
  line-height: 1.1;
}
.hero-label { font-size: 11px; color: rgba(255,255,255,0.75); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }

.hero-blue  { background: linear-gradient(135deg, #1e40af, #2563eb); }
.hero-sky   { background: linear-gradient(135deg, #0284c7, #0ea5e9); }
.hero-green { background: linear-gradient(135deg, #10b981, #059669); }
.hero-amber { background: linear-gradient(135deg, #f59e0b, #d97706); }

/* ── Sections ── */
.section { margin-bottom: 24px; }

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.section-icon svg { width: 18px; height: 18px; }

.section-icon-blue   { background: rgba(37,99,235,0.12);   color: #2563eb; }
.section-icon-amber  { background: rgba(245,158,11,0.12);  color: #f59e0b; }
.section-icon-green  { background: rgba(16,185,129,0.12);  color: #10b981; }
.section-icon-red    { background: rgba(239,68,68,0.12);   color: #ef4444; }
.section-icon-purple { background: rgba(139,92,246,0.12);  color: #8b5cf6; }
.section-icon-cyan   { background: rgba(14,165,233,0.12);  color: #0ea5e9; }

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
}

.collapse-arrow {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  transition: transform 0.25s;
  flex-shrink: 0;
}
.collapse-arrow.rotated { transform: rotate(-90deg); }

/* ── KPI row ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.kpi-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
}
.kpi-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  line-height: 1.1;
}
.kpi-lbl {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* ── Cards & rows ── */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  margin-bottom: 10px;
  overflow: hidden;
}

.card-section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  padding: 12px 16px 4px;
}

.row-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.row-item:last-child { border-bottom: none; }

.row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.muted { font-size: 12px; color: var(--text-secondary); }
.small { font-size: 11px; }
.text-danger  { color: #ef4444; }
.text-success { color: #10b981; }

/* ── Split bar ── */
.split-wrap { margin-bottom: 10px; }

.split-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-secondary);
  margin-bottom: 8px;
}
.split-fuel  { background: #2563eb; transition: width 0.5s ease; }
.split-other { background: #f59e0b; transition: width 0.5s ease; }

.split-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
}
.dot-blue  { background: #2563eb; }
.dot-amber { background: #f59e0b; }

/* ── Badges ── */
.badge-blue {
  font-size: 11px;
  background: rgba(37,99,235,0.12);
  color: #2563eb;
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 600;
}
.badge-amber {
  font-size: 11px;
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 600;
}
.badge-success {
  font-size: 11px;
  background: rgba(16,185,129,0.12);
  color: #10b981;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 700;
}
.badge-danger {
  font-size: 11px;
  background: rgba(239,68,68,0.12);
  color: #ef4444;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 700;
}

/* ── Record rows ── */
.record-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.record-row:last-child { border-bottom: none; }
.record-info { display: flex; flex-direction: column; gap: 2px; }
.record-info strong { font-size: 15px; }

/* ── Forecast banner ── */
.forecast-banner {
  display: flex;
  background: linear-gradient(135deg, #1e40af, #0ea5e9);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 10px;
  gap: 16px;
}

.forecast-item {
  flex: 1;
  text-align: center;
}

.forecast-label {
  font-size: 11px;
  color: rgba(255,255,255,0.75);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}

.forecast-value {
  font-size: 22px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.5px;
}

.forecast-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  margin-top: 3px;
}

.forecast-divider {
  width: 1px;
  background: rgba(255,255,255,0.2);
}

/* ── Efficiency trend ── */
.efficiency-trend {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}

.trend-arrow {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.trend-arrow svg { width: 22px; height: 22px; }
.trend-up   { background: rgba(16,185,129,0.12); color: #10b981; }
.trend-down { background: rgba(239,68,68,0.12);  color: #ef4444; }

.trend-text { display: flex; flex-direction: column; gap: 2px; }

/* ── Interval cards ── */
.interval-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.interval-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  text-align: center;
}
.interval-val {
  font-size: 28px;
  font-weight: 800;
  color: #10b981;
  letter-spacing: -1px;
  line-height: 1;
}
.interval-unit {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-top: 4px;
}
.interval-label { font-size: 14px; font-weight: 500; }

/* ── Rank badge ── */
.rank-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Detailed list ── */
.detail-list { padding: 0; }

.detail-header {
  display: grid;
  grid-template-columns: 80px 50px 50px 60px 60px;
  gap: 4px;
  padding: 10px 16px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.detail-row {
  display: grid;
  grid-template-columns: 80px 50px 50px 60px 60px;
  gap: 4px;
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  align-items: center;
}
.detail-row:last-child { border-bottom: none; }

.detail-date { color: var(--text-secondary); font-size: 12px; }
.detail-consumption { color: #10b981; font-weight: 600; }

/* ── Charts ── */
.chart-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 10px;
}
.chart-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 14px;
}
.chart-wrap { height: 200px; }
.chart-wrap-sm { height: 160px; }
.chart-wrap-doughnut { height: 240px; }

/* ── Category ── */
.cat-dot-row { display: flex; align-items: center; gap: 8px; }
.cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ── Empty ── */
.empty-section {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
