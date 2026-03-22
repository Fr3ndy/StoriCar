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
  addFuelRecord,
  updateFuelRecord,
  getFuelRecord,
  getDefaultVehicleId,
  getLastFuelRecord,
  getPrevFuelRecord,
  getFuelRecordsByVehicle
} = useStorage()
const { position, address, loading: geoLoading, error: geoError, getCurrentPosition, clearPosition } = useGeolocation()
const { fetchPrices, loading: pricesLoading } = useFuelPrices()

// Mappa fuelType veicolo → nome API carburante
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

const form = ref({
  vehicleId: '',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  liters: '',
  pricePerLiter: '',
  odometer: '',
  remainingRange: '',
  fullTank: true,
  notes: '',
  location: null,
  address: ''
})

// Which field the user explicitly typed last: null | 'liters' | 'pricePerLiter'
const lockedField = ref(null)

// Stato prezzi carburante vicini
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

// Previous record for odometer hint and remainingRange reference
const prevRecord = computed(() => {
  if (!form.value.vehicleId) return null
  if (!isEditing.value) return getLastFuelRecord(form.value.vehicleId)
  return getPrevFuelRecord(
    form.value.vehicleId,
    editId.value,
    form.value.odometer ? parseFloat(form.value.odometer) : null
  )
})

// Km percorsi = semplice differenza odometro. L'autonomia rimasta è solo un
// dato informativo e NON modifica il calcolo dei km.
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
        amount: record.amount?.toString() || '',
        liters: record.liters?.toString() || '',
        pricePerLiter: record.pricePerLiter?.toString() || '',
        odometer: record.odometer?.toString() || '',
        remainingRange: record.remainingRange?.toString() || '',
        fullTank: record.fullTank !== false, // default true per record vecchi
        notes: record.notes || '',
        location: record.location || null,
        address: record.address || ''
      }
      if (record.location) {
        position.value = record.location
        address.value = record.address
      }
    } else {
      router.push('/fuel')
    }
  } else {
    const defaultId = getDefaultVehicleId()
    if (defaultId) {
      form.value.vehicleId = defaultId
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

// Distanza in km tra due coordinate (formula Haversine)
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
  if (!fuelName) {
    pricesSearchDone.value = true
    return
  }

  const result = await fetchPrices({ lat, lng, km: 3 })
  pricesSearchDone.value = true

  if (!result?.impianti?.length) return

  // Filtra le stazioni con il carburante cercato e coordinate valide,
  // poi ordina per distanza dalla posizione utente → prende la più vicina
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

function dismissPrice() {
  priceDismissed.value = true
}

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
    amount: parseFloat(form.value.amount) || 0,
    liters: parseFloat(form.value.liters) || 0,
    pricePerLiter: parseFloat(form.value.pricePerLiter) || 0,
    kmDriven: kmDrivenToSave.value,
    odometer: form.value.odometer ? parseFloat(form.value.odometer) : null,
    remainingRange: form.value.remainingRange !== '' ? parseFloat(form.value.remainingRange) : null,
    fullTank: form.value.fullTank,
    notes: form.value.notes,
    location: form.value.location,
    address: form.value.address
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
</script>

<template>
  <div class="view-container">
    <div class="card form-card">

      <!-- Vehicle selector -->
      <div class="form-group">
        <label class="form-label">Veicolo *</label>
        <select v-model="form.vehicleId" class="form-select">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === data.settings?.defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Date -->
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input v-model="form.date" type="date" class="form-input" required />
      </div>

      <!-- Section: Km -->
      <div class="section-divider"><span>Chilometri</span></div>

      <div v-if="prevRecord?.odometer" class="info-box">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="info-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Ultimo contakm: <strong>{{ prevRecord.odometer.toLocaleString('it-IT') }} km</strong>
          <span v-if="prevRecord.date"> · {{ new Date(prevRecord.date).toLocaleDateString('it-IT') }}</span>
          <!-- autonomia storica nascosta insieme al campo input (vedi commento sopra) -->
          <!-- <span v-if="prevRecord.remainingRange != null" class="info-range"> · autonomia {{ prevRecord.remainingRange }} km</span> -->
        </span>
      </div>

      <!-- <div class="form-row"> -->
        <div class="form-group">
          <label class="form-label">Contakm attuale *</label>
          <input
            v-model="form.odometer"
            type="number"
            step="1"
            min="0"
            class="form-input"
            placeholder="es. 45000"
            required
          />
        </div>

        <!--
          CAMPO AUTONOMIA RIMASTA — temporaneamente nascosto.

          Il dato viene già salvato nel record (campo remainingRange) ma
          non viene più mostrato nel form perché il suo utilizzo statistico
          non è ancora implementato correttamente.

          PROBLEMA: la formula precedente usava questo campo per correggere
          i km percorsi (effective = rawKm + prevRange - currRange), ma questo
          ha senso solo se:
            1. L'autonomia viene inserita DOPO aver fatto benzina (non prima)
            2. L'utente lo fa in modo coerente per ogni rifornimento
          Senza queste garanzie, il calcolo introduceva errori imprevedibili.

          COSA AVREBBE SENSO FARE:
          - Usare remainingRange per ponderare il consumo nei rifornimenti
            parziali (pieno non completo): se l'autonomia dopo il pieno è
            molto più alta del solito, vuol dire che hai messo poca benzina
            rispetto alla capienza del serbatoio.
          - In StatsView, il consumo medio potrebbe essere calcolato come
            (litriTotali) / (kmTotaliEffettivi) su una serie di rifornimenti
            dove i kmEffettivi tengono conto del carburante residuo.
          - Prima di riattivare: decidere se il dato si inserisce PRIMA o
            DOPO aver fatto benzina, e indicarlo chiaramente nel label.

          <div class="form-group">
            <label class="form-label">Autonomia rimasta (dopo pieno)</label>
            <input
              v-model="form.remainingRange"
              type="number"
              step="1"
              min="0"
              class="form-input"
              placeholder="es. 150"
            />
          </div>
        -->
      <!-- </div> -->

      <!-- Km driven display -->
      <div class="form-group">
        <label class="form-label">Km percorsi</label>
        <div class="km-display" :class="{ 'km-calculated': kmDrivenCalc != null }">
          <span v-if="kmDrivenCalc != null">
            {{ Math.round(kmDrivenCalc).toLocaleString('it-IT') }} km
          </span>
          <span v-else class="km-placeholder">Inserisci contakm</span>
        </div>
      </div>

      <!-- Section: Carburante -->
      <div class="section-divider"><span>Carburante</span></div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Importo (€) *</label>
          <input
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0"
            class="form-input"
            placeholder="50.00"
            required
          />
        </div>
        <div class="form-group">
          <label class="form-label">
            Litri
            <span :class="['field-badge', lockedField === 'liters' ? 'locked' : 'auto']">
              {{ lockedField === 'liters' ? 'manuale' : 'auto' }}
            </span>
          </label>
          <input
            v-model="form.liters"
            type="number"
            step="0.01"
            min="0"
            class="form-input"
            :class="{ 'input-locked': lockedField === 'liters' }"
            placeholder="auto"
            @input="lockedField = 'liters'"
          />
        </div>
      </div>

      <!-- Price per liter -->
      <div class="form-group">
        <label class="form-label">
          Prezzo al litro (€/L)
          <span :class="['field-badge', lockedField === 'pricePerLiter' ? 'locked' : 'auto']">
            {{ lockedField === 'pricePerLiter' ? 'manuale' : 'auto' }}
          </span>
        </label>

        <!-- Nearby price banner -->
        <div v-if="nearbyPrice && !priceDismissed && vehicleFuelApiName" class="price-banner">
          <div class="price-banner-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="price-pin">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div class="price-banner-text">
              <div class="price-station">{{ nearbyStation?.nome || 'Distributore' }} · {{ vehicleFuelApiName }}</div>
              <div class="price-value"><strong>€ {{ nearbyPrice.toFixed(3) }}</strong>/L</div>
            </div>
          </div>
          <div class="price-banner-actions">
            <button type="button" class="price-btn accept" @click="useNearbyPrice">È corretto</button>
            <button type="button" class="price-btn dismiss" @click="dismissPrice">È diverso</button>
          </div>
        </div>

        <!-- Loading -->
        <div v-else-if="pricesLoading" class="price-status loading">
          <div class="spinner-xs"></div>
          Ricerca prezzi vicini…
        </div>

        <!-- No stations -->
        <div
          v-else-if="pricesSearchDone && !nearbyPrice && form.location && vehicleFuelApiName && !priceDismissed"
          class="price-status"
        >
          Nessun distributore trovato nelle vicinanze
        </div>

        <input
          v-model="form.pricePerLiter"
          type="number"
          step="0.001"
          min="0"
          class="form-input"
          :class="{ 'input-locked': lockedField === 'pricePerLiter' }"
          placeholder="1.659"
          @input="lockedField = 'pricePerLiter'"
        />
      </div>

      <!-- Pieno completo toggle -->
      <div class="full-tank-toggle" @click="form.fullTank = !form.fullTank">
        <div class="ft-icon" :class="{ 'ft-icon-full': form.fullTank }">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <div class="ft-text">
          <span class="ft-label">{{ form.fullTank ? 'Pieno completo' : 'Rifornimento parziale' }}</span>
          <span class="ft-sub">{{ form.fullTank ? 'Serbatoio riempito al massimo' : 'Non è stato fatto il pieno' }}</span>
        </div>
        <div class="ft-switch" :class="{ active: form.fullTank }">
          <div class="ft-thumb"></div>
        </div>
      </div>

      <!-- Section: Altro -->
      <div class="section-divider"><span>Altro</span></div>

      <!-- Location -->
      <div class="form-group">
        <label class="form-label">Posizione stazione</label>

        <button
          type="button"
          class="location-btn"
          :class="{ active: form.location }"
          @click="getLocation"
          :disabled="geoLoading || pricesLoading"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{{ geoLoading ? 'Rilevamento…' : pricesLoading ? 'Ricerca prezzi…' : form.location ? 'Aggiorna posizione' : 'Rileva posizione' }}</span>
        </button>

        <div v-if="form.location" class="location-preview">
          <div class="location-coords">{{ form.location.lat.toFixed(6) }}, {{ form.location.lng.toFixed(6) }}</div>
          <div v-if="form.address" class="location-address">{{ form.address }}</div>
          <button type="button" class="btn btn-sm btn-secondary" style="margin-top:8px" @click="removeLocation">Rimuovi</button>
        </div>

        <div v-if="geoError" class="field-error">{{ geoError }}</div>
      </div>

      <!-- Notes -->
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
  padding: 20px 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

/* Section divider */
.section-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 14px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.section-divider span {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Info box */
.info-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.info-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--primary);
}

.info-range {
  color: var(--primary);
  font-weight: 600;
}

/* Km display */
.km-display {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  font-size: 15px;
  color: var(--text-secondary);
}

.km-display.km-calculated {
  color: var(--text-primary);
  font-weight: 500;
}

.km-display.km-effective {
  border-color: var(--primary);
  background: rgba(37,99,235,0.05);
}

.km-placeholder {
  font-size: 13px;
}

.km-badge {
  font-size: 11px;
  background: rgba(37,99,235,0.1);
  color: var(--primary);
  padding: 2px 7px;
  border-radius: 20px;
  font-weight: 700;
}

/* Field badge */
.field-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: 6px;
  vertical-align: middle;
}

.field-badge.auto {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.field-badge.locked {
  background: rgba(37,99,235,0.1);
  color: var(--primary);
}

.form-input.input-locked {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
}

/* Price banner */
.price-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(37,99,235,0.06);
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.price-banner-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.price-pin {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--primary);
}

.price-banner-text { min-width: 0; }

.price-station {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.price-value {
  font-size: 14px;
  color: var(--text-primary);
}

.price-banner-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.price-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.price-btn:active { opacity: 0.7; }

.price-btn.accept {
  background: var(--primary);
  color: #fff;
}

.price-btn.dismiss {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.price-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 10px;
}

.price-status.loading { background: transparent; border: none; padding-left: 0; }

.spinner-xs {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Location */
.location-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.location-btn svg { width: 16px; height: 16px; flex-shrink: 0; }

.location-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(37,99,235,0.04);
}

.location-btn.active {
  border-style: solid;
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(37,99,235,0.05);
}

.location-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.location-preview {
  margin-top: 10px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.location-coords {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.location-address {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.field-error {
  font-size: 13px;
  color: var(--danger);
  margin-top: 6px;
}

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}

/* Full tank toggle */
.full-tank-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 4px;
  user-select: none;
}
.full-tank-toggle:hover { background: var(--bg-secondary); }
.ft-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: var(--text-secondary); transition: all 0.15s;
}
.ft-icon svg { width: 18px; height: 18px; }
.ft-icon.ft-icon-full {
  background: rgba(37,99,235,0.1);
  border-color: rgba(37,99,235,0.25);
  color: var(--primary);
}
.ft-text { flex: 1; }
.ft-label { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); }
.ft-sub { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 1px; }
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
</style>
