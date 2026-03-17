<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const {
  data,
  setTheme,
  setConsumptionUnit,
  getConsumptionUnit,
  setSetting,
  getSetting,
  saveToFile,
  importData,
  clearAllData
} = useStorage()

const currentTheme = computed(() => data.value.settings.theme)
const consumptionUnit = computed({
  get: () => getConsumptionUnit(),
  set: (val) => setConsumptionUnit(val)
})

// Settings refs
const distanceUnit      = computed({ get: () => getSetting('distanceUnit') || 'km', set: v => setSetting('distanceUnit', v) })
const volumeUnit        = computed({ get: () => getSetting('volumeUnit') || 'L', set: v => setSetting('volumeUnit', v) })
const dateFormat        = computed({ get: () => getSetting('dateFormat') || 'DD/MM/YYYY', set: v => setSetting('dateFormat', v) })
const defaultFuelType   = computed({ get: () => getSetting('defaultFuelType') || '', set: v => setSetting('defaultFuelType', v) })
const showOdometer      = computed({ get: () => getSetting('showOdometer') !== false, set: v => setSetting('showOdometer', v) })
const showRemainingRange = computed({ get: () => getSetting('showRemainingRange') !== false, set: v => setSetting('showRemainingRange', v) })
const notifyDays        = computed({ get: () => getSetting('notifyDeadlinesDays') ?? 30, set: v => setSetting('notifyDeadlinesDays', Number(v)) })

// Mappa carburanti
const fuelMapLat    = computed({ get: () => getSetting('fuelMapLat')    ?? null,  set: v => setSetting('fuelMapLat', v) })
const fuelMapLng    = computed({ get: () => getSetting('fuelMapLng')    ?? null,  set: v => setSetting('fuelMapLng', v) })
const fuelMapRadius = computed({ get: () => getSetting('fuelMapRadius') ?? 10,    set: v => setSetting('fuelMapRadius', Number(v)) })

const mapLatInput = ref('')
const mapLngInput = ref('')
const gpsLocating = ref(false)
const gpsError    = ref('')

// Inizializza gli input dai valori salvati
if (fuelMapLat.value != null) mapLatInput.value = String(fuelMapLat.value)
if (fuelMapLng.value != null) mapLngInput.value = String(fuelMapLng.value)

function applyMapCoords() {
  const lat = parseFloat(mapLatInput.value)
  const lng = parseFloat(mapLngInput.value)
  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    fuelMapLat.value = lat
    fuelMapLng.value = lng
    gpsError.value = ''
  } else {
    gpsError.value = 'Coordinate non valide'
  }
}

async function detectMapPosition() {
  if (!navigator.geolocation) { gpsError.value = 'GPS non supportato'; return }
  gpsLocating.value = true
  gpsError.value = ''
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
    )
    fuelMapLat.value = parseFloat(pos.coords.latitude.toFixed(5))
    fuelMapLng.value = parseFloat(pos.coords.longitude.toFixed(5))
    mapLatInput.value = String(fuelMapLat.value)
    mapLngInput.value = String(fuelMapLng.value)
  } catch {
    gpsError.value = 'Impossibile ottenere la posizione'
  } finally {
    gpsLocating.value = false
  }
}

function clearMapArea() {
  fuelMapLat.value = null
  fuelMapLng.value = null
  mapLatInput.value = ''
  mapLngInput.value = ''
}

const fileInput = ref(null)
const importError = ref('')
const importSuccess = ref(false)

// Stats
const totalVehicles = computed(() => data.value.vehicles.length)
const totalFuelRecords = computed(() => data.value.fuelRecords.length)
const totalExpenses = computed(() => data.value.expenses.length)
const totalDeadlines = computed(() => (data.value.deadlines || []).length)

function toggleTheme() {
  setTheme(currentTheme.value === 'light' ? 'dark' : 'light')
}

function downloadData() {
  saveToFile()
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleFileImport(event) {
  const file = event.target.files?.[0]
  if (!file) return
  importError.value = ''
  importSuccess.value = false
  try {
    const text = await file.text()
    const success = await importData(text)
    if (success) {
      importSuccess.value = true
      setTimeout(() => { importSuccess.value = false }, 3000)
    } else {
      importError.value = 'Errore nel formato del file'
    }
  } catch (e) {
    importError.value = 'Errore nella lettura del file'
  }
  event.target.value = ''
}

async function resetData() {
  if (confirm('Sei sicuro di voler eliminare TUTTI i dati? Questa azione non può essere annullata.')) {
    await clearAllData()
    router.push('/')
  }
}
</script>

<template>
  <div class="settings-view">

    <!-- ── App identity ── -->
    <div class="app-hero">
      <div class="app-hero-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <div class="app-hero-info">
        <div class="app-hero-name">Storicar</div>
        <div class="app-hero-sub">Car Expense Tracker · v2.0</div>
      </div>
    </div>

    <!-- ── Riepilogo dati ── -->
    <div class="data-summary">
      <div class="summary-item">
        <div class="summary-val">{{ totalVehicles }}</div>
        <div class="summary-lbl">Veicoli</div>
      </div>
      <div class="summary-item">
        <div class="summary-val">{{ totalFuelRecords }}</div>
        <div class="summary-lbl">Rifornimenti</div>
      </div>
      <div class="summary-item">
        <div class="summary-val">{{ totalExpenses }}</div>
        <div class="summary-lbl">Spese</div>
      </div>
      <div class="summary-item">
        <div class="summary-val">{{ totalDeadlines }}</div>
        <div class="summary-lbl">Scadenze</div>
      </div>
    </div>

    <!-- ── Aspetto ── -->
    <div class="settings-group">
      <div class="group-title">Aspetto</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Tema</div>
          <div class="setting-description">Chiaro o scuro</div>
        </div>
        <div class="theme-toggle-row">
          <button
            class="theme-btn-opt"
            :class="{ active: currentTheme === 'light' }"
            @click="setTheme('light')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Chiaro
          </button>
          <button
            class="theme-btn-opt"
            :class="{ active: currentTheme === 'dark' }"
            @click="setTheme('dark')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Scuro
          </button>
        </div>
      </div>
    </div>

    <!-- ── Unità di misura ── -->
    <div class="settings-group">
      <div class="group-title">Unità di misura</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Consumo carburante</div>
          <div class="setting-description">Come visualizzare il consumo</div>
        </div>
        <select v-model="consumptionUnit" class="form-select setting-select">
          <option value="kmL">km/L</option>
          <option value="L100km">L/100km</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Distanza</div>
          <div class="setting-description">Unità di misura per i km</div>
        </div>
        <select v-model="distanceUnit" class="form-select setting-select">
          <option value="km">Chilometri (km)</option>
          <option value="mi">Miglia (mi)</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Volume carburante</div>
          <div class="setting-description">Unità per il carburante</div>
        </div>
        <select v-model="volumeUnit" class="form-select setting-select">
          <option value="L">Litri (L)</option>
          <option value="gal">Galloni (gal)</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Formato data</div>
          <div class="setting-description">Come mostrare le date</div>
        </div>
        <select v-model="dateFormat" class="form-select setting-select">
          <option value="DD/MM/YYYY">GG/MM/AAAA</option>
          <option value="MM/DD/YYYY">MM/GG/AAAA</option>
          <option value="YYYY-MM-DD">AAAA-MM-GG</option>
        </select>
      </div>
    </div>

    <!-- ── Inserimento dati ── -->
    <div class="settings-group">
      <div class="group-title">Inserimento dati</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Tipo carburante predefinito</div>
          <div class="setting-description">Pre-compilato nei nuovi rifornimenti</div>
        </div>
        <select v-model="defaultFuelType" class="form-select setting-select">
          <option value="">Nessuno</option>
          <option value="Benzina">Benzina</option>
          <option value="Diesel">Diesel</option>
          <option value="GPL">GPL</option>
          <option value="Metano">Metano</option>
          <option value="Elettrico">Elettrico</option>
          <option value="Ibrido">Ibrido</option>
        </select>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Mostra odometro</div>
          <div class="setting-description">Campo km nel form rifornimento</div>
        </div>
        <label class="toggle">
          <input type="checkbox" :checked="showOdometer" @change="e => setSetting('showOdometer', e.target.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Mostra autonomia residua</div>
          <div class="setting-description">Campo range nel form rifornimento</div>
        </div>
        <label class="toggle">
          <input type="checkbox" :checked="showRemainingRange" @change="e => setSetting('showRemainingRange', e.target.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- ── Notifiche ── -->
    <div class="settings-group">
      <div class="group-title">Notifiche e scadenze</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Avviso scadenze</div>
          <div class="setting-description">Giorni di anticipo per l'avviso</div>
        </div>
        <div class="notify-input-wrap">
          <input
            type="number"
            class="setting-text-input setting-num"
            :value="notifyDays"
            @input="e => setSetting('notifyDeadlinesDays', Number(e.target.value))"
            min="1" max="365"
          />
          <span class="notify-unit">gg</span>
        </div>
      </div>
    </div>

    <!-- ── Veicoli ── -->
    <div class="settings-group">
      <div class="group-title">Veicoli</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Gestisci veicoli</div>
          <div class="setting-description">Aggiungi, modifica o elimina veicoli</div>
        </div>
        <button class="btn btn-sm btn-secondary" @click="router.push('/vehicles')">
          Gestisci
        </button>
      </div>
    </div>

    <!-- ── Mappa carburanti ── -->
    <div class="settings-group">
      <div class="group-title">Mappa carburanti</div>

      <div class="setting-item setting-item-col">
        <div class="setting-info">
          <div class="setting-label">Area di riferimento</div>
          <div class="setting-description">
            <span v-if="fuelMapLat && fuelMapLng">
              {{ fuelMapLat }}, {{ fuelMapLng }}
            </span>
            <span v-else>Non impostata — verrà usata la posizione GPS al momento della ricerca</span>
          </div>
        </div>
        <div class="map-area-controls">
          <div class="map-coords-row">
            <input
              v-model="mapLatInput"
              type="number"
              step="0.00001"
              class="setting-text-input setting-coord"
              placeholder="Latitudine"
              @blur="applyMapCoords"
            />
            <input
              v-model="mapLngInput"
              type="number"
              step="0.00001"
              class="setting-text-input setting-coord"
              placeholder="Longitudine"
              @blur="applyMapCoords"
            />
          </div>
          <div class="map-area-btns">
            <button class="btn btn-sm btn-secondary" @click="detectMapPosition" :disabled="gpsLocating">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px;height:14px">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {{ gpsLocating ? 'Rilevamento...' : 'Usa GPS' }}
            </button>
            <button v-if="fuelMapLat" class="btn btn-sm btn-secondary" @click="clearMapArea">
              Rimuovi
            </button>
          </div>
          <div v-if="gpsError" class="map-area-error">{{ gpsError }}</div>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Raggio di ricerca</div>
          <div class="setting-description">Distanza massima dal centro area</div>
        </div>
        <div class="notify-input-wrap">
          <input
            type="number"
            class="setting-text-input setting-num"
            :value="fuelMapRadius"
            @input="e => fuelMapRadius = Number(e.target.value)"
            min="1" max="50"
          />
          <span class="notify-unit">km</span>
        </div>
      </div>
    </div>

    <!-- ── Gestione dati ── -->
    <div class="settings-group">
      <div class="group-title">Gestione dati</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Esporta dati</div>
          <div class="setting-description">Scarica tutti i dati in formato JSON</div>
        </div>
        <button class="btn btn-sm btn-secondary" @click="downloadData">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Esporta
        </button>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Importa dati</div>
          <div class="setting-description">Carica dati da un file JSON</div>
        </div>
        <button class="btn btn-sm btn-secondary" @click="triggerImport">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Importa
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileImport"
        />
      </div>

      <div v-if="importError" class="feedback-msg error-msg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ importError }}
      </div>
      <div v-if="importSuccess" class="feedback-msg success-msg">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Dati importati con successo!
      </div>
    </div>

    <!-- ── Zona pericolo ── -->
    <div class="settings-group danger-group">
      <div class="group-title danger-title">Zona pericolosa</div>

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Elimina tutti i dati</div>
          <div class="setting-description">Cancella permanentemente tutti i dati</div>
        </div>
        <button class="btn btn-sm btn-danger" @click="resetData">
          Elimina tutto
        </button>
      </div>
    </div>

    <!-- ── Info ── -->
    <div class="app-footer">
      <div class="app-footer-logo">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <div class="app-footer-name">Storicar</div>
      <div class="app-footer-version">Versione 2.0.0</div>
      <div class="app-footer-desc">Traccia le spese della tua auto in modo semplice</div>
      <div class="app-footer-author">
        Sviluppato da
        <a href="https://github.com/Fr3ndy/StoriCar" target="_blank" rel="noopener" class="app-footer-link">Andrea Spina</a>
      </div>
    </div>

  </div>
</template>

<style scoped>
.settings-view {
  padding-bottom: 16px;
}

/* ── App hero ── */
.app-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #1e40af, #2563eb);
  border-radius: 18px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.app-hero-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.app-hero-icon svg { width: 26px; height: 26px; color: white; }

.app-hero-name {
  font-size: 22px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.5px;
}
.app-hero-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin-top: 2px;
}

/* ── Data summary ── */
.data-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.summary-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}

.summary-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: -0.5px;
}

.summary-lbl {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-top: 2px;
}

/* ── Settings groups ── */
.settings-group {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  margin-bottom: 14px;
  overflow: hidden;
}

.group-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--border);
}

.danger-group {
  border-color: rgba(239,68,68,0.3);
}

.danger-title {
  color: #ef4444;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.setting-select {
  width: auto;
  min-width: 130px;
  font-size: 14px;
  padding: 8px 30px 8px 10px;
}

.setting-text-input {
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  width: 120px;
}
.setting-text-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.setting-num {
  width: 70px;
  text-align: center;
}

.notify-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.notify-unit {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

/* ── Theme buttons ── */
.theme-toggle-row {
  display: flex;
  gap: 6px;
}

.theme-btn-opt {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;
}
.theme-btn-opt svg { width: 15px; height: 15px; }
.theme-btn-opt.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* ── Toggle switch ── */
.toggle {
  position: relative;
  display: inline-block;
  width: 46px;
  height: 26px;
  flex-shrink: 0;
}
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border);
  border-radius: 13px;
  transition: 0.25s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--text-secondary);
  border-radius: 50%;
  transition: 0.25s;
}
.toggle input:checked + .toggle-slider {
  background: var(--primary);
  border-color: var(--primary);
}
.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px) translateY(-50%);
  background: white;
}

/* ── Feedback messages ── */
.feedback-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}
.feedback-msg svg { width: 16px; height: 16px; flex-shrink: 0; }

.error-msg { color: var(--danger); background: rgba(239,68,68,0.06); }
.success-msg { color: var(--success); background: rgba(16,185,129,0.06); }

/* ── App footer ── */
.app-footer {
  text-align: center;
  padding: 24px 16px;
  color: var(--text-secondary);
}

.app-footer-logo {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
}
.app-footer-logo svg { width: 26px; height: 26px; color: var(--primary); }

.app-footer-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.app-footer-version {
  font-size: 12px;
  margin-top: 3px;
  font-weight: 600;
}
.app-footer-desc {
  font-size: 13px;
  margin-top: 6px;
  color: var(--text-secondary);
}
.app-footer-author {
  font-size: 12px;
  margin-top: 8px;
  color: var(--text-secondary);
}
.app-footer-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
}
.app-footer-link:hover {
  text-decoration: underline;
}

/* Mappa carburanti */
.setting-item-col {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.map-area-controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.map-coords-row {
  display: flex;
  gap: 8px;
}
.setting-coord {
  flex: 1;
  width: 0;
  min-width: 0;
  font-size: 13px;
}
.map-area-btns {
  display: flex;
  gap: 8px;
}
.map-area-error {
  font-size: 12px;
  color: var(--danger);
}
</style>
