<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useGeolocation } from '../composables/useGeolocation'
import { useFuelPrices } from '../composables/useFuelPrices'

const router = useRouter()
const route = useRoute()
const {
  data,
  selectedVehicleId,
  addFuelRecord,
  updateFuelRecord,
  getFuelRecord,
  getLastFuelRecord,
  getPrevFuelRecord,
  getFuelRecordsByVehicle
} = useStorage()
const { position, address, loading: geoLoading, error: geoError, getCurrentPosition, clearPosition } = useGeolocation()
const { fetchPrices, loading: pricesLoading } = useFuelPrices()

const FUEL_TYPE_MAP = {
  benzina: 'Benzina',
  diesel: 'Gasolio',
  gpl: 'GPL',
  metano: 'Metano',
  elettrico: null,
  ibrido: 'Benzina'
}

const isEditing = computed(() => route.name === 'fuel-edit')
const editId = computed(() => route.params.id)
const vehicles = computed(() => data.value.vehicles)

const nowTime = () => new Date().toTimeString().slice(0, 5)

const form = ref({
  vehicleId: '',
  date: new Date().toISOString().split('T')[0],
  time: nowTime(),
  amount: '',
  liters: '',
  pricePerLiter: '',
  odometer: '',
  remainingRange: '',
  fullTank: false,
  notes: '',
  location: null,
  address: '',
  computerConsumption: ''
})

const consUnit = computed(() => data.value.settings?.consumptionUnit || 'kmL')
const consUnitLabel = computed(() => consUnit.value === 'L100km' ? 'L/100km' : 'km/L')

const lockedField = ref(null)

const nearbyPrice = ref(null)
const nearbyStation = ref(null)
const pricesSearchDone = ref(false)
const priceDismissed = ref(false)

const selectedVehicle = computed(() =>
  vehicles.value.find(v => v.id === form.value.vehicleId) ?? null
)
const vehicleFuelApiName = computed(() => {
  if (!selectedVehicle.value) return null
  return FUEL_TYPE_MAP[selectedVehicle.value.fuelType] ?? null
})

// ---- Watch: auto-calculate the unlocked field ----
watch(() => form.value.amount, (amount) => {
  const amt = parseFloat(amount)
  if (!amt || amt <= 0) return
  if (lockedField.value === 'pricePerLiter') {
    const ppl = parseFloat(form.value.pricePerLiter)
    if (ppl > 0) form.value.liters = (amt / ppl).toFixed(2)
  } else if (form.value.liters && parseFloat(form.value.liters) > 0) {
    const lit = parseFloat(form.value.liters)
    form.value.pricePerLiter = (amt / lit).toFixed(3)
  }
})

watch(() => form.value.liters, (liters) => {
  if (lockedField.value !== 'liters') return
  const amt = parseFloat(form.value.amount)
  const lit = parseFloat(liters)
  if (amt > 0 && lit > 0) form.value.pricePerLiter = (amt / lit).toFixed(3)
})

watch(() => form.value.pricePerLiter, (ppl) => {
  if (lockedField.value !== 'pricePerLiter') return
  const amt = parseFloat(form.value.amount)
  const p = parseFloat(ppl)
  if (amt > 0 && p > 0) form.value.liters = (amt / p).toFixed(2)
})

const prevRecord = computed(() => {
  if (!form.value.vehicleId) return null
  if (!isEditing.value) return getLastFuelRecord(form.value.vehicleId)
  return getPrevFuelRecord(
    form.value.vehicleId,
    editId.value,
    form.value.odometer ? parseFloat(form.value.odometer) : null
  )
})

const kmDrivenCalc = computed(() => {
  if (!form.value.odometer || !prevRecord.value?.odometer) return null
  const rawKm = parseFloat(form.value.odometer) - prevRecord.value.odometer
  if (rawKm <= 0) return null
  return rawKm
})
const kmDrivenToSave = computed(() => kmDrivenCalc.value ?? 0)

onMounted(async () => {
  if (isEditing.value && editId.value) {
    const record = getFuelRecord(editId.value)
    if (record) {
      form.value = {
        vehicleId: record.vehicleId,
        date: record.date,
        time: record.time || '',
        amount: record.amount?.toString() || '',
        liters: record.liters?.toString() || '',
        pricePerLiter: record.pricePerLiter?.toString() || '',
        odometer: record.odometer?.toString() || '',
        remainingRange: record.remainingRange?.toString() || '',
        fullTank: record.fullTank !== false,
        notes: record.notes || '',
        location: record.location || null,
        address: record.address || '',
        computerConsumption: record.computerConsumption?.toString() || ''
      }
      if (record.location) {
        position.value = record.location
        address.value = record.address
      }
    } else {
      router.push('/fuel')
    }
  } else {
    if (selectedVehicleId.value) {
      form.value.vehicleId = selectedVehicleId.value
    } else if (vehicles.value.length > 0) {
      form.value.vehicleId = vehicles.value[0].id
    }
    await getLocation()
  }
})

async function getLocation() {
  priceDismissed.value = false
  pricesSearchDone.value = false
  nearbyPrice.value = null
  nearbyStation.value = null
  await getCurrentPosition()
  if (position.value) {
    form.value.location = position.value
    form.value.address = address.value || ''
    await searchNearbyPrice(position.value.lat, position.value.lng)
  }
}

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function searchNearbyPrice(lat, lng) {
  const fuelName = vehicleFuelApiName.value
  if (!fuelName) { pricesSearchDone.value = true; return }
  const result = await fetchPrices({ lat, lng, km: 3 })
  pricesSearchDone.value = true
  if (!result?.impianti?.length) return
  const station = result.impianti
    .filter(imp => imp.prezzi?.[fuelName] && imp.lat != null && imp.lng != null)
    .sort((a, b) => distKm(lat, lng, a.lat, a.lng) - distKm(lat, lng, b.lat, b.lng))[0]
  if (!station) return
  nearbyStation.value = station
  const p = station.prezzi[fuelName]
  nearbyPrice.value = p.self ?? p.servito ?? null
}

function useNearbyPrice() {
  if (nearbyPrice.value) {
    form.value.pricePerLiter = nearbyPrice.value.toFixed(3)
    lockedField.value = 'pricePerLiter'
  }
  priceDismissed.value = true
}

function dismissPrice() { priceDismissed.value = true }

function removeLocation() {
  clearPosition()
  form.value.location = null
  form.value.address = ''
  nearbyPrice.value = null
  nearbyStation.value = null
  pricesSearchDone.value = false
  priceDismissed.value = false
}

async function save() {
  const recordData = {
    vehicleId: form.value.vehicleId,
    date: form.value.date,
    time: form.value.time || null,
    amount: parseFloat(form.value.amount) || 0,
    liters: parseFloat(form.value.liters) || 0,
    pricePerLiter: parseFloat(form.value.pricePerLiter) || 0,
    kmDriven: kmDrivenToSave.value,
    odometer: form.value.odometer ? parseFloat(form.value.odometer) : null,
    remainingRange: form.value.remainingRange !== '' ? parseFloat(form.value.remainingRange) : null,
    fullTank: form.value.fullTank,
    notes: form.value.notes,
    location: form.value.location,
    address: form.value.address,
    computerConsumption: form.value.computerConsumption ? parseFloat(form.value.computerConsumption) : null
  }
  if (isEditing.value) {
    await updateFuelRecord(editId.value, recordData)
  } else {
    await addFuelRecord(recordData)
  }
  router.push('/fuel')
}

const canSave = computed(() =>
  form.value.vehicleId && form.value.date && form.value.amount && form.value.odometer
)

// Quick "oggi" shortcut
function setToday() {
  form.value.date = new Date().toISOString().split('T')[0]
  form.value.time = nowTime()
}
const isToday = computed(() => form.value.date === new Date().toISOString().split('T')[0])
</script>

<template>
  <div class="view-container">

    <!-- ── Form card ── -->
    <div class="card form-card">

      <!-- ══ SEZIONE: QUANDO ══ -->
      <div class="section-header">
        <span class="section-icon">🗓️</span>
        <span class="section-title">Quando</span>
        <button v-if="!isToday" type="button" class="today-btn" @click="setToday">Oggi</button>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data *</label>
          <input v-model="form.date" type="date" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Orario</label>
          <input v-model="form.time" type="time" class="form-input" />
        </div>
      </div>

      <!-- ══ SEZIONE: CHILOMETRI ══ -->
      <div class="section-header">
        <span class="section-icon">🛣️</span>
        <span class="section-title">Chilometri</span>
      </div>

      <!-- Hint ultimo contakm -->
      <div v-if="prevRecord?.odometer" class="info-pill">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Ultimo: <strong>{{ prevRecord.odometer.toLocaleString('it-IT') }} km</strong>
        <span v-if="prevRecord.date" class="info-date">· {{ new Date(prevRecord.date).toLocaleDateString('it-IT', { day:'2-digit', month:'short' }) }}</span>
      </div>

      <!-- Odometer + Km percorsi affiancati -->
      <div class="form-row km-row">
        <div class="form-group">
          <label class="form-label">Contakm *</label>
          <input
            v-model="form.odometer"
            type="number" step="1" min="0"
            class="form-input"
            placeholder="es. 45000"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label">Km percorsi</label>
          <div class="km-display" :class="{ 'km-active': kmDrivenCalc != null }">
            <span v-if="kmDrivenCalc != null" class="km-value">
              {{ Math.round(kmDrivenCalc).toLocaleString('it-IT') }}
              <span class="km-unit">km</span>
            </span>
            <span v-else class="km-empty">— km</span>
          </div>
        </div>
      </div>

      <!-- Consumo computer di bordo -->
      <div class="form-group">
        <label class="form-label">
          Consumo bordo
          <span class="label-sub">{{ consUnitLabel }}</span>
        </label>
        <input
          v-model="form.computerConsumption"
          type="number" class="form-input"
          placeholder="es. 7,3" min="0" step="0.1"
        />
      </div>

      <!-- ══ SEZIONE: CARBURANTE ══ -->
      <div class="section-header">
        <span class="section-icon">⛽</span>
        <span class="section-title">Carburante</span>
      </div>

      <!-- Importo: grande e prominente -->
      <div class="form-group">
        <label class="form-label">Importo (€) *</label>
        <div class="amount-input-wrap">
          <span class="amount-prefix">€</span>
          <input
            v-model="form.amount"
            type="number" step="0.01" min="0"
            class="form-input amount-input"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <!-- Litri × €/L: card calcolatore -->
      <div class="calc-card">
        <!-- Litri -->
        <div class="calc-field">
          <div class="calc-label-row">
            <span class="calc-label">Litri</span>
            <span class="field-badge" :class="lockedField === 'liters' ? 'locked' : 'auto'">
              {{ lockedField === 'liters' ? 'manuale' : 'auto' }}
            </span>
          </div>
          <input
            v-model="form.liters"
            type="number" step="0.01" min="0"
            class="form-input calc-input"
            :class="{ 'input-locked': lockedField === 'liters' }"
            placeholder="—"
            @input="lockedField = 'liters'"
          />
        </div>

        <div class="calc-sep">×</div>

        <!-- Prezzo/L -->
        <div class="calc-field">
          <div class="calc-label-row">
            <span class="calc-label">€ / L</span>
            <span class="field-badge" :class="lockedField === 'pricePerLiter' ? 'locked' : 'auto'">
              {{ lockedField === 'pricePerLiter' ? 'manuale' : 'auto' }}
            </span>
          </div>

          <!-- Nearby price banner compatto -->
          <div v-if="nearbyPrice && !priceDismissed && vehicleFuelApiName" class="price-banner">
            <div class="price-banner-top">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span class="price-station-name">{{ nearbyStation?.nome || 'Distributore' }}</span>
              <strong class="price-val">€ {{ nearbyPrice.toFixed(3) }}</strong>
            </div>
            <div class="price-banner-btns">
              <button type="button" class="price-btn accept" @click="useNearbyPrice">✓ Usa</button>
              <button type="button" class="price-btn dismiss" @click="dismissPrice">✗</button>
            </div>
          </div>
          <div v-else-if="pricesLoading" class="price-loading">
            <div class="spinner-xs"></div> Ricerca…
          </div>

          <input
            v-model="form.pricePerLiter"
            type="number" step="0.001" min="0"
            class="form-input calc-input"
            :class="{ 'input-locked': lockedField === 'pricePerLiter' }"
            placeholder="—"
            @input="lockedField = 'pricePerLiter'"
          />
        </div>
      </div>

      <!-- Pieno completo toggle -->
      <div class="full-tank-toggle" @click="form.fullTank = !form.fullTank">
        <div class="ft-icon" :class="{ active: form.fullTank }">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <div class="ft-text">
          <span class="ft-label">{{ form.fullTank ? 'Pieno completo' : 'Parziale' }}</span>
          <span class="ft-sub">{{ form.fullTank ? 'Serbatoio al massimo' : 'Non è stato fatto il pieno' }}</span>
        </div>
        <div class="ft-switch" :class="{ active: form.fullTank }">
          <div class="ft-thumb"></div>
        </div>
      </div>

      <!-- ══ SEZIONE: DETTAGLI ══ -->
      <div class="section-header">
        <span class="section-icon">📍</span>
        <span class="section-title">Dettagli</span>
      </div>

      <!-- Location -->
      <div class="form-group">
        <label class="form-label">Posizione stazione</label>

        <!-- Se posizione già rilevata -->
        <div v-if="form.location" class="location-card">
          <div class="location-card-top">
            <div class="location-card-info">
              <div v-if="form.address" class="location-address">{{ form.address }}</div>
              <div class="location-coords">{{ form.location.lat.toFixed(5) }}, {{ form.location.lng.toFixed(5) }}</div>
            </div>
            <div class="location-card-btns">
              <button
                type="button" class="loc-icon-btn"
                @click="getLocation" :disabled="geoLoading || pricesLoading"
                title="Aggiorna posizione"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
              <button type="button" class="loc-icon-btn danger" @click="removeLocation" title="Rimuovi">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Se posizione non ancora rilevata -->
        <button
          v-else
          type="button" class="location-btn"
          @click="getLocation"
          :disabled="geoLoading || pricesLoading"
        >
          <span v-if="geoLoading || pricesLoading" class="spinner-xs"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          {{ geoLoading ? 'Rilevamento…' : pricesLoading ? 'Ricerca prezzi…' : 'Rileva posizione' }}
        </button>

        <div v-if="geoError" class="field-error">{{ geoError }}</div>
      </div>

      <!-- Note -->
      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea v-model="form.notes" class="form-input" rows="2" placeholder="Note opzionali…"></textarea>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button class="btn btn-secondary" @click="router.back()">Annulla</button>
        <button class="btn btn-primary" @click="save" :disabled="!canSave">
          {{ isEditing ? 'Salva modifiche' : 'Aggiungi' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 0 0 40px;
}

.form-card {
  padding: 0;
  overflow: hidden;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 0 16px;
  margin-bottom: 14px;
}

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
.section-header:first-child { border-top: none; margin-top: 0; padding-top: 18px; }
.section-icon { font-size: 16px; line-height: 1; }
.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-secondary);
  flex: 1;
}
.today-btn {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1.5px solid var(--primary);
  background: rgba(99,102,241,0.08);
  color: var(--primary);
  cursor: pointer;
}

/* ── Form elements ── */
.form-group {
  padding: 0 16px;
  margin-bottom: 14px;
}

/* ── Info pill ── */
.info-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 16px 12px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}
.info-pill svg { width: 13px; height: 13px; flex-shrink: 0; color: var(--primary); }
.info-pill strong { color: var(--text-primary); }
.info-date { opacity: 0.65; }

/* ── Km row ── */
.km-row { margin-bottom: 14px; }

.km-display {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  transition: all 0.15s;
}
.km-display.km-active {
  border-color: rgba(16,185,129,0.4);
  background: rgba(16,185,129,0.05);
}
.km-value {
  font-size: 16px;
  font-weight: 700;
  color: #059669;
}
.km-unit { font-size: 12px; font-weight: 500; margin-left: 3px; color: #059669; opacity: 0.7; }
.km-empty { font-size: 14px; color: var(--text-secondary); opacity: 0.45; }

.label-sub {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 5px;
}

/* ── Importo ── */
.amount-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.amount-prefix {
  position: absolute;
  left: 14px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
  pointer-events: none;
  z-index: 1;
}
.amount-input {
  padding-left: 32px !important;
  font-size: 22px !important;
  font-weight: 800 !important;
  height: 56px !important;
  letter-spacing: -0.5px;
  color: var(--text-primary) !important;
}

/* ── Calc card ── */
.calc-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 16px 14px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.calc-field { flex: 1; min-width: 0; }
.calc-label-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
}
.calc-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.calc-input { background: var(--bg-card) !important; }
.calc-sep {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-secondary);
  opacity: 0.4;
  padding-top: 28px;
  flex-shrink: 0;
}

/* Field badge */
.field-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.field-badge.auto { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border); }
.field-badge.locked { background: rgba(99,102,241,0.1); color: var(--primary); }
.form-input.input-locked { border-color: var(--primary); }

/* ── Price banner (compatto, dentro calc-card) ── */
.price-banner {
  background: rgba(99,102,241,0.07);
  border: 1.5px solid var(--primary);
  border-radius: 9px;
  padding: 7px 9px;
  margin-bottom: 7px;
}
.price-banner-top {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 6px;
}
.price-banner-top svg { width: 13px; height: 13px; color: var(--primary); flex-shrink: 0; }
.price-station-name {
  font-size: 10px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.price-val { font-size: 13px; font-weight: 800; color: var(--primary); flex-shrink: 0; }
.price-banner-btns { display: flex; gap: 5px; }
.price-btn {
  flex: 1;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 0;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: center;
}
.price-btn:active { opacity: 0.7; }
.price-btn.accept { background: var(--primary); color: white; }
.price-btn.dismiss { background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border); }

.price-loading {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.spinner-xs {
  width: 12px; height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Full tank toggle ── */
.full-tank-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 16px 4px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.full-tank-toggle:active { background: var(--bg-secondary); }

.ft-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: var(--text-secondary); transition: all 0.15s;
}
.ft-icon svg { width: 18px; height: 18px; }
.ft-icon.active { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: var(--primary); }
.ft-text { flex: 1; }
.ft-label { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); }
.ft-sub { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.ft-switch {
  width: 42px; height: 24px; border-radius: 12px;
  background: var(--border); flex-shrink: 0;
  position: relative; transition: background 0.2s;
}
.ft-switch.active { background: var(--primary); }
.ft-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
.ft-switch.active .ft-thumb { transform: translateX(18px); }

/* ── Location ── */
.location-btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px;
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.location-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.location-btn:not(:disabled):active { border-color: var(--primary); color: var(--primary); background: rgba(99,102,241,0.04); }
.location-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.location-card {
  border: 1.5px solid var(--primary);
  border-radius: 12px;
  background: rgba(99,102,241,0.05);
  padding: 11px 12px;
}
.location-card-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.location-card-info { flex: 1; min-width: 0; }