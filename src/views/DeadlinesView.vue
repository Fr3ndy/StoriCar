<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const { data, dataReady, addDeadline, updateDeadline, deleteDeadline, getDeadlinesByVehicle, setDefaultVehicle, getDefaultVehicleId, getSetting, setSetting } = useStorage()

// ── Notifiche Push ────────────────────────────────────────────
const notifEnabled = computed(() => getSetting('notificationsEnabled') ?? false)
const notifSupported = 'Notification' in window && 'serviceWorker' in navigator

async function toggleNotifiche() {
  if (!notifSupported) return
  if (notifEnabled.value) {
    await setSetting('notificationsEnabled', false)
    return
  }
  const perm = await Notification.requestPermission()
  if (perm === 'granted') {
    await setSetting('notificationsEnabled', true)
    scheduleNotifiche()
  }
}

function scheduleNotifiche() {
  if (!notifEnabled.value) return
  const deadlines = data.value.deadlines || []
  const today = new Date(); today.setHours(0,0,0,0)
  deadlines.forEach(dl => {
    const expiry = new Date(dl.expiryDate); expiry.setHours(0,0,0,0)
    const days = Math.ceil((expiry - today) / 86400000)
    const reminderDays = dl.reminderDays || 30
    if (days >= 0 && days <= reminderDays) {
      const label = deadlineTypes.find(t => t.value === dl.type)?.label || dl.type
      new Notification('Storicar — Scadenza imminente', {
        body: `${label}${dl.description ? ' – ' + dl.description : ''} scade ${days === 0 ? 'oggi' : 'in ' + days + ' giorni'}`,
        icon: '/CARB/pwa-192x192.png',
        tag: `deadline-${dl.id}`
      })
    }
  })
}

const vehicles = computed(() => data.value.vehicles)
const selectedVehicleId = ref(null)

watch(dataReady, (ready) => {
  if (!ready) return
  const defaultId = getDefaultVehicleId()
  if (defaultId && vehicles.value.find(v => v.id === defaultId)) {
    selectedVehicleId.value = defaultId
  } else if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }
}, { immediate: true })

const deadlineTypes = [
  { value: 'assicurazione', label: 'Assicurazione', icon: '🛡️' },
  { value: 'bollo',         label: 'Bollo',         icon: '📄' },
  { value: 'tagliando',     label: 'Tagliando',     icon: '🔧' },
  { value: 'revisione',     label: 'Revisione',     icon: '🔍' },
  { value: 'gomme',         label: 'Cambio Gomme',  icon: '⚙️' },
  { value: 'altro',         label: 'Altro',         icon: '📌' }
]

const showForm = ref(false)
const editingId = ref(null)
const form = ref({
  type: 'assicurazione',
  description: '',
  expiryDate: '',
  amount: '',
  reminderDays: 30,
  notes: ''
})

const deadlines = computed(() => {
  if (!selectedVehicleId.value) return []
  return getDeadlinesByVehicle(selectedVehicleId.value)
})

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const expiry = new Date(dateStr); expiry.setHours(0,0,0,0)
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
}

function statusClass(deadline) {
  const days = daysUntil(deadline.expiryDate)
  if (days === null) return ''
  if (days < 0) return 'expired'
  if (days <= (deadline.reminderDays || 30)) return 'expiring'
  return 'ok'
}

function statusLabel(deadline) {
  const days = daysUntil(deadline.expiryDate)
  if (days === null) return ''
  if (days < 0) return `Scaduta da ${Math.abs(days)} gg`
  if (days === 0) return 'Scade oggi!'
  if (days <= (deadline.reminderDays || 30)) return `Scade in ${days} gg`
  return `${days} giorni`
}

function onVehicleChange(e) {
  selectedVehicleId.value = e.target.value
  setDefaultVehicle(e.target.value)
}

function openAddForm() {
  editingId.value = null
  form.value = { type: 'assicurazione', description: '', expiryDate: '', amount: '', reminderDays: 30, notes: '' }
  showForm.value = true
}

function openEditForm(deadline) {
  editingId.value = deadline.id
  form.value = {
    type: deadline.type || 'assicurazione',
    description: deadline.description || '',
    expiryDate: deadline.expiryDate || '',
    amount: deadline.amount || '',
    reminderDays: deadline.reminderDays ?? 30,
    notes: deadline.notes || ''
  }
  showForm.value = true
}

function saveDeadline() {
  const payload = {
    vehicleId: selectedVehicleId.value,
    type: form.value.type,
    description: form.value.description,
    expiryDate: form.value.expiryDate,
    amount: form.value.amount ? parseFloat(form.value.amount) : null,
    reminderDays: parseInt(form.value.reminderDays) || 30,
    notes: form.value.notes
  }
  if (editingId.value) {
    updateDeadline(editingId.value, payload)
  } else {
    addDeadline(payload)
  }
  showForm.value = false
}

function confirmDelete(deadline) {
  const label = deadlineTypes.find(t => t.value === deadline.type)?.label || deadline.type
  if (confirm(`Eliminare la scadenza "${label}"?`)) {
    deleteDeadline(deadline.id)
  }
}

function getTypeInfo(typeValue) {
  return deadlineTypes.find(t => t.value === typeValue) || { label: typeValue, icon: '📌' }
}

const canSave = computed(() => form.value.expiryDate && selectedVehicleId.value)
</script>

<template>
  <div class="view-container">

    <!-- No vehicles -->
    <div v-if="vehicles.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <!-- Form: add/edit deadline -->
    <div v-else-if="showForm" class="card form-card">
      <h3 class="form-title">{{ editingId ? 'Modifica Scadenza' : 'Nuova Scadenza' }}</h3>

      <div class="form-group">
        <label class="form-label">Tipo</label>
        <div class="type-grid">
          <button
            v-for="dt in deadlineTypes"
            :key="dt.value"
            type="button"
            class="type-chip"
            :class="{ active: form.type === dt.value }"
            @click="form.type = dt.value"
          >
            <span>{{ dt.icon }}</span> {{ dt.label }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Data scadenza *</label>
        <input v-model="form.expiryDate" type="date" class="form-input" required />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Importo (€)</label>
          <input v-model="form.amount" type="number" class="form-input" placeholder="es. 450" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">Avviso (giorni prima)</label>
          <input v-model="form.reminderDays" type="number" class="form-input" min="1" max="365" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <input v-model="form.description" type="text" class="form-input" placeholder="es. Rinnovo annuale" />
      </div>

      <div class="form-group">
        <label class="form-label">Note</label>
        <input v-model="form.notes" type="text" class="form-input" placeholder="Note aggiuntive" />
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="showForm = false">Annulla</button>
        <button class="btn btn-primary" @click="saveDeadline" :disabled="!canSave">
          {{ editingId ? 'Salva modifiche' : 'Aggiungi' }}
        </button>
      </div>
    </div>

    <!-- List -->
    <template v-else>
      <!-- Vehicle selector -->
      <div style="margin-bottom:12px">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Notifications toggle -->
      <div v-if="notifSupported" class="notif-bar" :class="{ enabled: notifEnabled }">
        <div class="notif-left">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="notif-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <span>Notifiche scadenze</span>
        </div>
        <button class="toggle" :class="{ on: notifEnabled }" @click="toggleNotifiche">
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <!-- Empty -->
      <div v-if="deadlines.length === 0" class="empty-state" style="padding-top:32px">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2>Nessuna scadenza</h2>
        <p>Aggiungi assicurazione, bollo o manutenzione</p>
      </div>

      <!-- Deadline cards -->
      <div v-for="dl in deadlines" :key="dl.id" class="deadline-card card" :class="statusClass(dl)">
        <div class="dl-header">
          <div class="dl-left">
            <span class="dl-icon">{{ getTypeInfo(dl.type).icon }}</span>
            <div>
              <div class="dl-title">
                <span class="dl-type">{{ getTypeInfo(dl.type).label }}</span>
                <span v-if="dl.description" class="dl-desc">{{ dl.description }}</span>
              </div>
              <div class="dl-date">
                {{ new Date(dl.expiryDate).toLocaleDateString('it-IT') }}
                <span v-if="dl.amount"> · {{ dl.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 }) }} €</span>
              </div>
            </div>
          </div>
          <div class="dl-status" :class="statusClass(dl)">{{ statusLabel(dl) }}</div>
        </div>

        <div v-if="dl.notes" class="dl-notes">{{ dl.notes }}</div>

        <div class="dl-actions">
          <button class="action-btn" @click="openEditForm(dl)" title="Modifica">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="action-btn danger" @click="confirmDelete(dl)" title="Elimina">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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

/* Form */
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

/* Type chips */
.type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}

.type-chip.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Notif bar */
.notif-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  margin-bottom: 12px;
  gap: 12px;
  transition: all 0.18s;
}

.notif-bar.enabled {
  border-color: var(--primary);
  background: rgba(37,99,235,0.05);
}

.notif-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.notif-icon {
  width: 18px;
  height: 18px;
  color: var(--primary);
  flex-shrink: 0;
}

/* Toggle */
.toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--border);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.toggle.on { background: var(--primary); }

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.toggle.on .toggle-thumb { transform: translateX(20px); }

/* Deadline card */
.deadline-card {
  padding: 14px 16px;
  margin-bottom: 10px;
  border-left: 4px solid var(--border);
  transition: border-color 0.18s;
  border-radius: var(--r-md);
}

.deadline-card.expiring { border-left-color: var(--warning); }
.deadline-card.expired  { border-left-color: var(--danger); }
.deadline-card.ok       { border-left-color: var(--success); }

.dl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dl-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
}

.dl-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}

.dl-title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.dl-type {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.dl-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.dl-date {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 3px;
}

.dl-status {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.dl-status.expiring {
  background: rgba(245,158,11,0.12);
  color: #b45309;
}

.dl-status.expired {
  background: rgba(239,68,68,0.12);
  color: #b91c1c;
}

.dl-status.ok {
  background: rgba(16,185,129,0.12);
  color: #047857;
}

[data-theme="dark"] .dl-status.expiring { background: rgba(245,158,11,0.15); color: #fcd34d; }
[data-theme="dark"] .dl-status.expired  { background: rgba(239,68,68,0.15);  color: #fca5a5; }
[data-theme="dark"] .dl-status.ok       { background: rgba(16,185,129,0.15); color: #6ee7b7; }

.dl-notes {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-style: italic;
}

.dl-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn svg { width: 15px; height: 15px; }
.action-btn:active { transform: scale(0.9); }
.action-btn.danger { color: var(--danger); }
.action-btn.danger:active { background: rgba(239,68,68,0.1); }
</style>
