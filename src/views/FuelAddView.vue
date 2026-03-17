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
  notes: '',
  location: null,
  address: ''
})

// Which field the user explicitly typed last: null | 'liters' | 'pricePerLiter'
const lockedField = ref(null)

// Stato prezzi carburante vicini
const nearbyPrice = ref(null)       // prezzo trovato dal distributore più vicino
const nearbyStation = ref(null)     // distributore più vicino
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

const kmDrivenCalc = computed(() => {
  if (!form.value.odometer || !prevRecord.value?.odometer) return null
  const rawKm = parseFloat(form.value.odometer) - prevRecord.value.odometer
  if (rawKm <= 0) return null
  const prevRange = prevRecord.value.remainingRange ?? null
  const currRange = form.value.remainingRange !== '' ? parseFloat(form.value.remainingRange) : null
  if (prevRange != null && currRange != null && !isNaN(currRange)) {
    const effective = rawKm + prevRange - currRange
    return effective > 0 ? effective : null
  }
  return rawKm
})

const kmDrivenIsEffective = computed(() =>
  prevRecord.value?.remainingRange != null && form.value.remainingRange !== ''
)
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
    // Rileva posizione automaticamente all'apertura
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

async function searchNearbyPrice(lat, lng) {
  const fuelName = vehicleFuelApiName.value
  if (!fuelName) {
    pricesSearchDone.value = true
    return
  }

  const result = await fetchPrices({ lat, lng, km: 3 })
  pricesSearchDone.value = true

  if (!result?.impianti?.length) return

  // Trova il distributore più vicino che ha il carburante del veicolo
  // L'API restituisce già ordinati per distanza, quindi il primo è il più vicino
  const station = result.impianti.find(imp => imp.prezzi?.[fuelName])
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
  <div class="fuel-add">
    <div class="card">

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

      <!-- Odometer section -->
      <div class="section-divider">
        <span>Chilometri</span>
      </div>

      <div v-if="prevRecord?.odometer" class="info-box">
        Ultimo contakm: <strong>{{ prevRecord.odometer.toLocaleString('it-IT') }} km</strong>
        <span v-if="prevRecord.date"> · {{ new Date(prevRecord.date).toLocaleDateString('it-IT') }}</span>
        <span v-if="prevRecord.remainingRange != null" class="info-box-range"> · autonomia {{ prevRecord.remainingRange }} km</span>
      </div>

      <div class="form-row">
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
        <div class="form-group">
          <label class="form-label">Autonomia rimanente</label>
          <input
            v-model="form.remainingRange"
            type="number"
            step="1"
            min="0"
            class="form-input"
            placeholder="es. 150 km"
          />
        </div>
      </div>

      <!-- Km driven display -->
      <div class="form-group">
        <label class="form-label">Km percorsi</label>
        <div class="form-input-readonly" :class="{ 'calculated': kmDrivenCalc != null, 'effective': kmDrivenIsEffective }">
          <span v-if="kmDrivenCalc != null">
            {{ Math.round(kmDrivenCalc).toLocaleString('it-IT') }} km
            <span v-if="kmDrivenIsEffective" class="effective-badge">corretto ✓</span>
          </span>
          <span v-else class="placeholder-text">Inserisci contakm</span>
        </div>
      </div>

      <!-- Fuel cost section -->
      <div class="section-divider">
        <span>Carburante</span>
      </div>

      <!-- Amount and Liters -->
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
            <span :class="lockedField === 'liters' ? 'field-badge locked' : 'field-badge auto'">
              {{ lockedField === 'liters' ? 'manuale' : 'auto' }}
            </span>
          </label>
          <input
            v-model="form.liters"
            type="number"
            step="0.01"
            min="0"
            class="form-input"
            :class="{ 'is-locked': lockedField === 'liters' }"
            placeholder="auto"
            @input="lockedField = 'liters'"
          />
        </div>
      </div>

      <!-- Price per liter -->
      <div class="form-group">
        <label class="form-label">
          Prezzo al litro (€/L)
          <span :class="lockedField === 'pricePerLiter' ? 'field-badge locked' : 'field-badge auto'">
            {{ lockedField === 'pricePerLiter' ? 'manuale' : 'auto' }}
          </span>
        </label>

        <!-- Banner prezzo distributore vicino -->
        <div
          v-if="nearbyPrice && !priceDismissed && vehicleFuelApiName"
          class="price-suggestion-banner"
        >
          <div class="price-suggestion-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="price-suggestion-icon">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <div class="price-suggestion-label">
                {{ nearbyStation?.nome || 'Distributore' }} · {{ vehicleFuelApiName }} · prezzo nei sistemi
              </div>
              <div class="price-suggestion-value">
                <strong>€ {{ nearbyPrice.toFixed(3) }}</strong>/L
              </div>
            </div>
          </div>
          <div class="price-suggestion-actions">
            <button type="button" class="btn-suggestion btn-suggestion-accept" @click="useNearbyPrice">
              È corretto
            </button>
            <button type="button" class="btn-suggestion btn-suggestion-dismiss" @click="dismissPrice">
              È diverso
            </button>
          </div>
        </div>

        <!-- Caricamento prezzi -->
        <div v-else-if="pricesLoading" class="price-loading">
          Ricerca prezzi vicini...
        </div>

        <!-- Nessun distributore trovato -->
        <div
          v-else-if="pricesSearchDone && !nearbyPrice && form.location && vehicleFuelApiName && !priceDismissed"
          class="price-no-stations"
        >
          Nessun distributore trovato nelle vicinanze
        </div>

        <input
          v-model="form.pricePerLiter"
          type="number"
          step="0.001"
          min="0"
          class="form-input"
          :class="{ 'is-locked': lockedField === 'pricePerLiter' }"
          placeholder="1.659"
          @input="lockedField = 'pricePerLiter'"
        />
      </div>

      <!-- Location section -->
      <div class="section-divider">
        <span>Altro</span>
      </div>

      <div class="form-group">
        <label class="form-label">Posizione stazione</label>

        <!-- Bottone rileva posizione: prioritario, mostrato anche se posizione già rilevata -->
        <button
          type="button"
          class="location-btn"
          :class="{ 'location-btn-active': form.location }"
          @click="getLocation"
          :disabled="geoLoading || pricesLoading"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ geoLoading ? 'Rilevamento...' : pricesLoading ? 'Ricerca prezzi...' : form.location ? 'Aggiorna posizione' : 'Rileva posizione' }}
        </button>

        <!-- Preview posizione rilevata -->
        <div v-if="form.location" class="location-preview">
          <div class="location-coords">{{ form.location.lat.toFixed(6) }}, {{ form.location.lng.toFixed(6) }}</div>
          <div v-if="form.address" class="location-address">{{ form.address }}</div>
          <button type="button" class="btn btn-sm btn-secondary mt-8" @click="removeLocation">Rimuovi</button>
        </div>

        <div v-if="geoError" class="error-text">{{ geoError }}</div>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea v-model="form.notes" class="form-input" rows="2" placeholder="Note opzionali..."></textarea>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button class="btn btn-secondary" @click="router.back()">Annulla</button>
        <button class="btn btn-primary" @click="save" :disabled="!canSave">
          {{ isEditing ? 'Salva' : 'Aggiungi' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 14px;
}

.section-divider span {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.info-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.info-box-range {
  color: var(--primary);
  font-weight: 500;
}

.form-input-readonly {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
  font-size: 15px;
}

.form-input-readonly.calculated {
  color: var(--text-primary);
  font-weight: 500;
}

.form-input-readonly.effective {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.05);
}

.form-input-readonly.not-available .placeholder-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.placeholder-text {
  color: var(--text-secondary);
  font-size: 13px;
}

.effective-badge {
  font-size: 11px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary);
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 700;
}

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
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary);
}

.form-input.is-locked {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

/* Posizione */
.location-btn-active {
  background: rgba(99, 102, 241, 0.08) !important;
  border-color: var(--primary) !important;
  color: var(--primary) !important;
}

.location-preview {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-top: 8px;
}

.location-coords {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 13px;
}

.location-address {
  font-size: 13px;
  color: var(--text-secondary);
}

.mt-8 { margin-top: 8px; }

.error-text {
  color: var(--danger);
  font-size: 14px;
  margin-top: 8px;
}

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}

/* Banner prezzo distributore vicino */
.price-suggestion-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(99, 102, 241, 0.07);
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.price-suggestion-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.price-suggestion-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--primary);
}

.price-suggestion-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.price-suggestion-value {
  font-size: 14px;
  color: var(--text-primary);
}

.price-suggestion-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-suggestion {
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-suggestion:active { opacity: 0.7; }

.btn-suggestion-accept {
  background: var(--primary);
  color: #fff;
}

.btn-suggestion-dismiss {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.price-loading {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 6px 10px;
}

.price-no-stations {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
}
</style>
