<script setup>
import { ref, computed } from 'vue'
import { useStorage } from '../composables/useStorage'
import { useAuth } from '../composables/useAuth'
import { supabase } from '../lib/supabase'

const { data, addVehicle, updateVehicle, deleteVehicle, setDefaultVehicle, getDefaultVehicleId } = useStorage()
const { user, isGuest } = useAuth()

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
  coverImageUrl: ''
})

const coverLoading = ref(false)
const coverError   = ref('')

async function uploadCoverImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''

  if (file.size > 5 * 1024 * 1024) {
    coverError.value = 'Immagine troppo grande (max 5 MB)'
    return
  }

  coverLoading.value = true
  coverError.value   = ''
  try {
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${user.value.id}/cover_${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('vehicle-covers')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) throw upErr
    const { data: urlData } = supabase.storage.from('vehicle-covers').getPublicUrl(path)
    form.value.coverImageUrl = urlData.publicUrl + '?t=' + Date.now()
  } catch (e) {
    coverError.value = 'Errore durante il caricamento. Riprova.'
    console.error('[cover upload]', e)
  } finally {
    coverLoading.value = false
  }
}

function removeCoverImage() {
  form.value.coverImageUrl = ''
}

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
  coverError.value = ''
  form.value = { name: '', vehicleType: 'auto', plate: '', brand: '', model: '', year: '', fuelType: 'benzina', initialOdometer: '', coverImageUrl: '' }
  showForm.value = true
}

function openEditForm(vehicle) {
  editingVehicle.value = vehicle.id
  coverError.value = ''
  form.value = {
    name: vehicle.name || '',
    vehicleType: vehicle.vehicleType || 'auto',
    plate: vehicle.plate || '',
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    year: vehicle.year || '',
    fuelType: vehicle.fuelType || 'benzina',
    initialOdometer: vehicle.initialOdometer || '',
    coverImageUrl: vehicle.coverImageUrl || ''
  }
  showForm.value = true
}

async function saveVehicle() {
  const vehicleData = {
    ...form.value,
    initialOdometer: form.value.initialOdometer ? parseFloat(form.value.initialOdometer) : 0,
    year: form.value.year ? parseInt(form.value.year) : null
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

      <!-- Cover image -->
      <div class="form-group">
        <label class="form-label">Foto di copertina</label>

        <!-- Preview -->
        <div v-if="form.coverImageUrl" class="cover-preview">
          <img :src="form.coverImageUrl" class="cover-preview-img" alt="Copertina" />
          <button type="button" class="cover-remove-btn" @click="removeCoverImage">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Rimuovi
          </button>
        </div>

        <!-- Upload / change button (disabled for guests) -->
        <label class="cover-upload-btn" :class="{ 'cover-upload-loading': coverLoading, 'cover-upload-disabled': isGuest }">
          <input
            type="file"
            accept="image/*"
            style="display:none"
            :disabled="coverLoading || isGuest"
            @change="uploadCoverImage"
          />
          <span v-if="coverLoading" class="cover-upload-inner">
            <div class="spinner-xs"></div>
            Caricamento…
          </span>
          <span v-else class="cover-upload-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {{ form.coverImageUrl ? 'Cambia foto' : 'Aggiungi foto' }}
          </span>
        </label>

        <p v-if="isGuest" class="cover-guest-note">Le foto di copertina richiedono un account Google</p>
        <p v-if="coverError" class="field-error">{{ coverError }}</p>
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
        <!-- Cover image banner -->
        <div
          v-if="vehicle.coverImageUrl"
          class="vehicle-cover-banner"
          :style="{ backgroundImage: `url(${vehicle.coverImageUrl})` }"
        ></div>

        <!-- Top row -->
        <div class="vehicle-top">
          <!-- Icon + info -->
          <div class="vehicle-left">
            <div class="vehicle-icon">
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
  overflow: hidden;
}

/* Cover banner (top of card, negative margin to break out of padding) */
.vehicle-cover-banner {
  height: 90px;
  background-size: cover;
  background-position: center;
  margin: -14px -16px 14px;
  border-radius: var(--r-md) var(--r-md) 0 0;
}

/* ── Cover upload ── */
.cover-preview {
  position: relative;
  margin-bottom: 10px;
  border-radius: 10px;
  overflow: hidden;
}
.cover-preview-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.cover-remove-btn {
  position: absolute;
  top: 8px; right: 8px;
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px;
  border-radius: 20px;
  border: none;
  background: rgba(0,0,0,0.55);
  color: white;
  font-size: 12px; font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
.cover-remove-btn svg { width: 13px; height: 13px; }

.cover-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 11px 16px;
  border-radius: 10px;
  border: 1.5px dashed var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 14px; font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.cover-upload-btn:hover:not(.cover-upload-disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.cover-upload-inner {
  display: flex; align-items: center; gap: 7px;
}
.cover-upload-inner svg { width: 18px; height: 18px; }
.cover-upload-loading { opacity: 0.7; cursor: not-allowed; }
.cover-upload-disabled { opacity: 0.5; cursor: not-allowed; }

.cover-guest-note {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 6px 0 0;
  text-align: center;
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
</style>
