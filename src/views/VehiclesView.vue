<script setup>
import { ref, computed } from 'vue'
import { useStorage } from '../composables/useStorage'

const { data, addVehicle, updateVehicle, deleteVehicle, setDefaultVehicle, getDefaultVehicleId } = useStorage()

const vehicles = computed(() => data.value.vehicles)
const defaultVehicleId = computed(() => getDefaultVehicleId())

const showForm = ref(false)
const editingVehicle = ref(null)
const form = ref({
  name: '',
  vehicleType: 'auto',
  plate: '',
  brand: '',
  model: '',
  year: '',
  fuelType: 'benzina',
  initialOdometer: '',
  coverImageUrl: '',       // URL immagine cover del veicolo
  coverPosition: 'center' // Preferenza crop: center | top | bottom | percentuale
})

// Opzioni di posizionamento immagine cover
const coverPositionOptions = [
  { value: 'top',    label: 'Alto' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Basso' },
]

const vehicleTypes = [
  { value: 'auto', label: 'Auto' },
  { value: 'moto', label: 'Moto' }
]

const fuelTypes = [
  { value: 'benzina', label: 'Benzina' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gpl', label: 'GPL' },
  { value: 'metano', label: 'Metano' },
  { value: 'elettrico', label: 'Elettrico' },
  { value: 'ibrido', label: 'Ibrido' }
]

function openAddForm() {
  editingVehicle.value = null
  form.value = {
    name: '', vehicleType: 'auto', plate: '', brand: '', model: '',
    year: '', fuelType: 'benzina', initialOdometer: '',
    coverImageUrl: '', coverPosition: 'center'
  }
  showForm.value = true
}

function openEditForm(vehicle) {
  editingVehicle.value = vehicle.id
  form.value = {
    name: vehicle.name || '',
    vehicleType: vehicle.vehicleType || 'auto',
    plate: vehicle.plate || '',
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    year: vehicle.year || '',
    fuelType: vehicle.fuelType || 'benzina',
    initialOdometer: vehicle.initialOdometer || '',
    coverImageUrl: vehicle.coverImageUrl || '',
    coverPosition: vehicle.coverPosition || 'center'
  }
  showForm.value = true
}

async function saveVehicle() {
  const vehicleData = {
    ...form.value,
    initialOdometer: form.value.initialOdometer ? parseFloat(form.value.initialOdometer) : 0,
    year: form.value.year ? parseInt(form.value.year) : null,
    // coverImageUrl e coverPosition già in form.value come stringhe
    coverImageUrl: form.value.coverImageUrl?.trim() || null,
    coverPosition: form.value.coverPosition || 'center'
  }
  if (editingVehicle.value) {
    await updateVehicle(editingVehicle.value, vehicleData)
  } else {
    await addVehicle(vehicleData)
  }
  showForm.value = false
}

async function confirmDelete(vehicle) {
  if (confirm(`Sei sicuro di voler eliminare "${vehicle.name}"? Tutti i dati associati verranno persi.`)) {
    await deleteVehicle(vehicle.id)
  }
}

async function setAsDefault(vehicleId) {
  await setDefaultVehicle(vehicleId)
}
</script>

<template>
  <div class="view-container">

    <!-- Form: add/edit vehicle -->
    <div v-if="showForm" class="card form-card">
      <h3 class="form-title">{{ editingVehicle ? 'Modifica Veicolo' : 'Nuovo Veicolo' }}</h3>

      <!-- Vehicle type toggle -->
      <div class="form-group">
        <label class="form-label">Tipo veicolo</label>
        <div class="type-toggle">
          <button
            v-for="vt in vehicleTypes"
            :key="vt.value"
            type="button"
            class="type-btn"
            :class="{ active: form.vehicleType === vt.value }"
            @click="form.vehicleType = vt.value"
          >
            <!-- Auto icon -->
            <svg v-if="vt.value === 'auto'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4" />
            </svg>
            <!-- Moto icon -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 0a2 2 0 100-4 2 2 0 000 4zm-7 8a7 7 0 1114 0M5 14a7 7 0 1114 0m-7-4v4m0 0l-3 3m3-3l3 3" />
            </svg>
            {{ vt.label }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input
          v-model="form.name"
          type="text"
          class="form-input"
          :placeholder="form.vehicleType === 'moto' ? 'es. La mia moto' : 'es. La mia auto'"
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label">Targa</label>
        <input v-model="form.plate" type="text" class="form-input" placeholder="es. AB123CD" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Marca</label>
          <input v-model="form.brand" type="text" class="form-input" placeholder="es. Fiat" />
        </div>
        <div class="form-group">
          <label class="form-label">Modello</label>
          <input v-model="form.model" type="text" class="form-input" placeholder="es. Panda" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Anno</label>
          <input v-model="form.year" type="number" class="form-input" placeholder="es. 2020" min="1900" max="2030" />
        </div>
        <div class="form-group">
          <label class="form-label">Carburante</label>
          <select v-model="form.fuelType" class="form-select">
            <option v-for="ft in fuelTypes" :key="ft.value" :value="ft.value">{{ ft.label }}</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Km iniziali</label>
        <input v-model="form.initialOdometer" type="number" class="form-input" placeholder="es. 50000" min="0" />
      </div>

      <!-- Cover immagine veicolo -->
      <div class="form-group">
        <label class="form-label">Foto copertina (URL)</label>
        <input
          v-model="form.coverImageUrl"
          type="url"
          class="form-input"
          placeholder="https://esempio.com/foto-auto.jpg"
        />
        <!-- Anteprima crop con posizione controllabile -->
        <div v-if="form.coverImageUrl" class="cover-preview">
          <div
            class="cover-preview-img"
            :style="{
              backgroundImage: `url('${form.coverImageUrl}')`,
              backgroundPosition: form.coverPosition,
            }"
          ></div>
          <div class="cover-position-row">
            <span class="cover-position-label">Posizione foto:</span>
            <button
              v-for="opt in coverPositionOptions"
              :key="opt.value"
              type="button"
              class="cover-pos-btn"
              :class="{ active: form.coverPosition === opt.value }"
              @click="form.coverPosition = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="showForm = false">Annulla</button>
        <button class="btn btn-primary" @click="saveVehicle" :disabled="!form.name">
          {{ editingVehicle ? 'Salva modifiche' : 'Aggiungi' }}
        </button>
      </div>
    </div>

    <!-- Vehicle list -->
    <template v-else>
      <div v-if="vehicles.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4" />
        </svg>
        <h2>Nessun veicolo</h2>
        <p>Aggiungi il tuo primo veicolo per iniziare</p>
      </div>

      <div v-for="vehicle in vehicles" :key="vehicle.id" class="card vehicle-card">

        <!-- Cover immagine veicolo (se disponibile) -->
        <div
          v-if="vehicle.coverImageUrl"
          class="vehicle-cover"
          :style="{
            backgroundImage: `url('${vehicle.coverImageUrl}')`,
            backgroundPosition: vehicle.coverPosition || 'center',
          }"
        >
          <!-- Overlay per leggibilità targa/nome -->
          <div class="vehicle-cover-overlay">
            <span class="vehicle-cover-name">{{ vehicle.name }}</span>
            <span v-if="vehicle.plate" class="vehicle-cover-plate">{{ vehicle.plate }}</span>
          </div>
        </div>

        <!-- Top row -->
        <div class="vehicle-top">
          <!-- Icon + info -->
          <div class="vehicle-left">
            <div class="vehicle-icon" :class="{ 'vehicle-icon-hidden': vehicle.coverImageUrl }">
              <svg v-if="vehicle.vehicleType === 'moto'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 0a2 2 0 100-4 2 2 0 000 4zm-7 8a7 7 0 1114 0M5 14a7 7 0 1114 0m-7-4v4m0 0l-3 3m3-3l3 3" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4" />
              </svg>
            </div>
            <div>
              <div class="vehicle-name-row">
                <span class="vehicle-name">{{ vehicle.name }}</span>
                <span v-if="vehicle.id === defaultVehicleId" class="default-pill">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Preferito
                </span>
              </div>
              <div class="vehicle-meta">
                {{ [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') }}
                <span v-if="vehicle.plate"> · {{ vehicle.plate }}</span>
              </div>
            </div>
          </div>

          <!-- Fuel badge -->
          <span class="fuel-badge">
            {{ fuelTypes.find(f => f.value === vehicle.fuelType)?.label || vehicle.fuelType }}
          </span>
        </div>

        <!-- Odometer info -->
        <div v-if="vehicle.initialOdometer" class="vehicle-odo">
          Km iniziali: <strong>{{ vehicle.initialOdometer.toLocaleString('it-IT') }}</strong>
        </div>

        <!-- Actions -->
        <div class="vehicle-actions">
          <button
            v-if="vehicle.id !== defaultVehicleId"
            class="btn btn-sm btn-secondary"
            @click="setAsDefault(vehicle.id)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Preferito
          </button>
          <button class="btn btn-sm btn-secondary" @click="openEditForm(vehicle)">Modifica</button>
          <button class="btn btn-sm btn-danger" @click="confirmDelete(vehicle)">Elimina</button>
        </div>
      </div>

      <button class="fab" @click="openAddForm">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.view-container {
  padding: 0 0 100px;
}

.form-card {
  padding: 20px 16px;
}

.form-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
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

/* Type toggle */
.type-toggle {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 11px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}

.type-btn svg { width: 18px; height: 18px; }

.type-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.type-btn:not(.active) { color: var(--text-secondary); }

/* Vehicle card */
.vehicle-card {
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: var(--r-md);
}

.vehicle-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.vehicle-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.vehicle-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--primary);
}

.vehicle-icon svg { width: 20px; height: 20px; }

.vehicle-name-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.vehicle-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.default-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  color: #f59e0b;
  background: rgba(245,158,11,0.1);
  padding: 2px 7px;
  border-radius: 20px;
}

.default-pill svg { width: 11px; height: 11px; }

.vehicle-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 3px;
}

.fuel-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 20px;
  background: rgba(37,99,235,0.1);
  color: var(--primary);
  flex-shrink: 0;
}

.vehicle-odo {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 10px;
}

.vehicle-actions {
  display: flex;
  gap: 7px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

/* ── Cover immagine veicolo ────────────────────────────────────────────────── */
.vehicle-cover {
  width: 100%;
  height: 140px;             /* card più alta per dare spazio alla foto */
  border-radius: var(--r-md) var(--r-md) 0 0;
  background-size: cover;
  background-repeat: no-repeat;
  /* object-position controllabile via inline style */
  position: relative;
  overflow: hidden;
  margin: -14px -16px 12px;  /* fuoriesce dai padding della card */
  width: calc(100% + 32px);
}

.vehicle-cover-overlay {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 10px 14px 8px;
  background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.vehicle-cover-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.vehicle-cover-plate {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  background: rgba(0,0,0,0.35);
  padding: 2px 7px;
  border-radius: 5px;
  backdrop-filter: blur(4px);
}

/* Nasconde l'icona veicolo se c'è già la cover */
.vehicle-icon-hidden { display: none; }

/* ── Anteprima cover nel form ──────────────────────────────────────────────── */
.cover-preview {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.cover-preview-img {
  width: 100%;
  height: 120px;
  background-size: cover;
  background-repeat: no-repeat;
  transition: background-position 0.2s;
}

.cover-position-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  flex-wrap: wrap;
}

.cover-position-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.cover-pos-btn {
  padding: 4px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cover-pos-btn.active {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(37,99,235,0.08);
}
</style>
