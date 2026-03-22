<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const { data, dataReady, getDefaultVehicleId, setDefaultVehicle, deleteFuelRecord } = useStorage()

const selectedVehicleId = ref(null)
const showFilters = ref(false)

// Filters
const filterYear = ref('')
const filterMonth = ref('')
const filterText = ref('')

const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)
const defaultVehicleId = computed(() => data.value.settings?.defaultVehicleId)

const allRecords = computed(() => {
  if (!selectedVehicleId.value) return []
  return data.value.fuelRecords
    .filter(r => r.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// Calcolo consumo fill-to-fill: solo tra due pieni completi (fullTank === true).
// Per ogni pieno completo N:
//   km     = odo_N - odo_{prevFull}
//   litri  = somma di tutti i litri da prevFull+1 a N incluso
// I record senza fullTank esplicito sono trattati come pieni (retrocompatibilità).
const consumptionMap = computed(() => {
  const asc = data.value.fuelRecords
    .filter(r => r.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const map = {}
  let prevFullIdx = -1

  for (let i = 0; i < asc.length; i++) {
    const curr = asc[i]
    const isFull = curr.fullTank !== false // default true per record pre-feature

    if (isFull && prevFullIdx >= 0) {
      const prevFull = asc[prevFullIdx]
      const km = (curr.odometer ?? 0) - (prevFull.odometer ?? 0)
      if (km > 0) {
        let totalLiters = 0
        for (let j = prevFullIdx + 1; j <= i; j++) {
          totalLiters += asc[j].liters ?? 0
        }
        if (totalLiters > 0) {
          map[curr.id] = { km, liters: totalLiters, kmPerL: km / totalLiters }
        }
      }
    }

    if (isFull) prevFullIdx = i
  }

  return map
})

const availableYears = computed(() => {
  const years = [...new Set(allRecords.value.map(r => new Date(r.date).getFullYear()))]
  return years.sort((a, b) => b - a)
})

const fuelRecords = computed(() => {
  let records = allRecords.value
  if (filterYear.value) {
    records = records.filter(r => new Date(r.date).getFullYear() === parseInt(filterYear.value))
  }
  if (filterMonth.value) {
    records = records.filter(r => (new Date(r.date).getMonth() + 1) === parseInt(filterMonth.value))
  }
  if (filterText.value) {
    const q = filterText.value.toLowerCase()
    records = records.filter(r =>
      (r.notes || '').toLowerCase().includes(q) ||
      (r.address || '').toLowerCase().includes(q)
    )
  }
  return records
})

const hasActiveFilters = computed(() => filterYear.value || filterMonth.value || filterText.value)

function resetFilters() {
  filterYear.value = ''
  filterMonth.value = ''
  filterText.value = ''
}

const months = [
  { value: '1', label: 'Gennaio' }, { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' }, { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' }, { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Dicembre' }
]

watch(dataReady, (ready) => {
  if (!ready) return
  const defaultId = getDefaultVehicleId()
  if (defaultId && vehicles.value.find(v => v.id === defaultId)) {
    selectedVehicleId.value = defaultId
  } else if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }
}, { immediate: true })

async function onVehicleChange(e) {
  selectedVehicleId.value = e.target.value
  await setDefaultVehicle(e.target.value)
}

function formatNumber(num, decimals = 2) {
  if (num == null) return '-'
  return num.toFixed(decimals).replace('.', ',')
}

function formatDay(dateStr) {
  return new Date(dateStr).getDate().toString().padStart(2, '0')
}

function formatMonthShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { month: 'short' })
}

function getConsumptionDisplay(record) {
  if (record.fullTank === false) return null // parziale: non mostrare consumo
  const c = consumptionMap.value[record.id]
  if (!c) return null
  if (data.value.settings.consumptionUnit === 'L100km') {
    return { value: ((c.liters / c.km) * 100).toFixed(1), unit: 'L/100' }
  }
  return { value: c.kmPerL.toFixed(1), unit: 'km/L' }
}

function consumptionClass(record) {
  if (record.fullTank === false) return ''
  const c = consumptionMap.value[record.id]
  if (!c) return ''
  if (c.kmPerL > 14) return 'cons-good'
  if (c.kmPerL > 9) return 'cons-avg'
  return 'cons-poor'
}

async function confirmDelete(record) {
  if (confirm('Sei sicuro di voler eliminare questo rifornimento?')) {
    await deleteFuelRecord(record.id)
  }
}

function editRecord(record) {
  router.push(`/fuel/edit/${record.id}`)
}
</script>

<template>
  <div class="view-wrap">

    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo per registrare i rifornimenti</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <template v-else>
      <!-- Vehicle selector -->
      <select class="form-select" style="margin-bottom:10px" :value="selectedVehicleId" @change="onVehicleChange">
        <option v-for="v in vehicles" :key="v.id" :value="v.id">
          {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
        </option>
      </select>

      <!-- Filter bar -->
      <div class="filter-bar card">
        <button class="filter-toggle" @click="showFilters = !showFilters">
          <div class="filter-toggle-left">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="filter-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.828V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.172a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" />
            </svg>
            <span>Filtri</span>
            <span v-if="hasActiveFilters" class="filter-dot"></span>
          </div>
          <div class="filter-toggle-right">
            <span class="record-count">{{ fuelRecords.length }} rifornimenti</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="chevron-icon" :class="{ rotated: showFilters }">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <div v-if="showFilters" class="filter-body">
          <div class="filter-row">
            <select v-model="filterYear" class="form-select">
              <option value="">Tutti gli anni</option>
              <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
            </select>
            <select v-model="filterMonth" class="form-select">
              <option value="">Tutti i mesi</option>
              <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <input v-model="filterText" type="text" class="form-input" placeholder="Cerca per indirizzo o note…" />
          <button v-if="hasActiveFilters" class="btn btn-sm btn-secondary" style="align-self:flex-start" @click="resetFilters">
            Rimuovi filtri
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="fuelRecords.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h2>{{ hasActiveFilters ? 'Nessun risultato' : 'Nessun rifornimento' }}</h2>
        <p>{{ hasActiveFilters ? 'Prova a modificare i filtri' : 'Registra il tuo primo rifornimento' }}</p>
        <button v-if="hasActiveFilters" class="btn btn-secondary" style="margin-top:16px" @click="resetFilters">Rimuovi filtri</button>
      </div>

      <!-- Timeline -->
      <div v-else class="timeline">
        <div v-for="(record, index) in fuelRecords" :key="record.id" class="tl-item">

          <!-- Date column -->
          <div class="tl-left">
            <div class="tl-date">
              <span class="tl-day">{{ formatDay(record.date) }}</span>
              <span class="tl-month">{{ formatMonthShort(record.date) }}</span>
            </div>
            <div v-if="index < fuelRecords.length - 1" class="tl-line"></div>
          </div>

          <!-- Card -->
          <div class="tl-card card">
            <!-- Top row -->
            <div class="tc-top" @click="editRecord(record)">
              <span class="tc-amount">{{ formatNumber(record.amount) }} €</span>
              <div class="tc-right">
                <span v-if="record.remainingRange != null" class="tc-range" title="Autonomia registrata">⚡</span>
                <span v-if="record.fullTank === false" class="tc-partial">parziale</span>
                <span
                  v-else-if="getConsumptionDisplay(record)"
                  class="tc-cons"
                  :class="consumptionClass(record)"
                >
                  {{ getConsumptionDisplay(record).value }} {{ getConsumptionDisplay(record).unit }}
                </span>
              </div>
            </div>

            <!-- Details chips -->
            <div class="tc-chips" @click="editRecord(record)">
              <span v-if="record.liters" class="tc-chip">{{ formatNumber(record.liters) }} L</span>
              <span v-if="record.pricePerLiter" class="tc-chip">{{ formatNumber(record.pricePerLiter, 3) }} €/L</span>
              <span v-if="record.kmDriven" class="tc-chip">{{ Math.round(record.kmDriven).toLocaleString('it-IT') }} km</span>
              <span v-if="record.odometer" class="tc-chip tc-chip-muted">odo {{ Math.round(record.odometer).toLocaleString('it-IT') }}</span>
            </div>

            <!-- Location -->
            <div v-if="record.address" class="tc-location" @click="editRecord(record)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{{ record.address }}</span>
            </div>

            <!-- Notes -->
            <div v-if="record.notes" class="tc-notes" @click="editRecord(record)">{{ record.notes }}</div>

            <!-- Actions -->
            <div class="tc-actions">
              <button class="tc-action-btn" @click="editRecord(record)" title="Modifica">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifica
              </button>
              <button class="tc-action-btn danger" @click="confirmDelete(record)" title="Elimina">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FAB -->
      <button class="fab" @click="router.push('/fuel/add')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.view-wrap { padding-bottom: 100px; }

/* Filter bar */
.filter-bar { padding: 12px 14px; margin-bottom: 12px; }

.filter-toggle {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: none; border: none; cursor: pointer;
  padding: 0; user-select: none;
}

.filter-toggle-left {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 600; color: var(--text-primary);
}

.filter-icon { width: 14px; height: 14px; color: var(--primary); flex-shrink: 0; }

.filter-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--primary); flex-shrink: 0;
}

.filter-toggle-right { display: flex; align-items: center; gap: 8px; }

.record-count { font-size: 12px; color: var(--text-secondary); }

.chevron-icon { width: 15px; height: 15px; color: var(--text-tertiary); transition: transform 0.2s; flex-shrink: 0; }
.chevron-icon.rotated { transform: rotate(180deg); }

.filter-body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }

.filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Timeline */
.timeline { display: flex; flex-direction: column; }

.tl-item { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }

.tl-left {
  display: flex; flex-direction: column;
  align-items: center; width: 40px; flex-shrink: 0;
}

.tl-date {
  width: 40px; height: 46px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.tl-day   { font-size: 16px; font-weight: 800; line-height: 1; color: var(--primary); }
.tl-month { font-size: 9px; color: var(--text-secondary); text-transform: uppercase;
  letter-spacing: 0.3px; font-weight: 700; }

.tl-line {
  width: 1.5px; flex: 1; background: var(--border);
  margin: 4px 0; min-height: 12px;
}

/* Timeline card */
.tl-card {
  flex: 1; min-width: 0;
  padding: 12px 14px; margin-bottom: 10px; overflow: hidden;
}

.tc-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; cursor: pointer;
}
.tc-amount { font-size: 19px; font-weight: 800; color: var(--text-primary); }

.tc-right { display: flex; align-items: center; gap: 6px; }

.tc-range { font-size: 12px; opacity: 0.6; }
.tc-partial {
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
  background: rgba(99,102,241,0.10); color: var(--primary);
}

.tc-cons {
  font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
  background: var(--bg-secondary); color: var(--text-secondary);
}
.cons-good { background: rgba(16,185,129,0.10); color: #10b981; }
.cons-avg  { background: rgba(245,158,11,0.10); color: #f59e0b; }
.cons-poor { background: rgba(239,68,68,0.10);  color: #ef4444; }

/* Detail chips */
.tc-chips {
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-bottom: 6px; cursor: pointer;
}
.tc-chip {
  font-size: 12px; font-weight: 600;
  padding: 3px 8px; border-radius: 20px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.tc-chip-muted { opacity: 0.6; }

/* Location */
.tc-location {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-secondary);
  margin-top: 4px; min-width: 0; cursor: pointer;
}
.tc-location svg { width: 11px; height: 11px; flex-shrink: 0; color: var(--primary); }
.tc-location span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

.tc-notes { font-size: 12px; color: var(--text-tertiary); font-style: italic; margin-top: 4px; cursor: pointer; }

/* Actions */
.tc-actions {
  display: flex; align-items: center; gap: 6px;
  justify-content: flex-end;
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border);
}

.tc-action-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.tc-action-btn svg { width: 13px; height: 13px; }
.tc-action-btn:active { opacity: .8; }
.tc-action-btn.danger {
  color: var(--danger);
  background: rgba(239,68,68,0.06);
  border-color: rgba(239,68,68,0.2);
  padding: 5px 8px;
}
.tc-action-btn.danger:active { background: rgba(239,68,68,0.12); }
</style>
