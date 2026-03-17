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
  { value: 'assicurazione', label: 'Assicurazione', icon: '🛡️', badgeClass: 'badge-insurance' },
  { value: 'bollo', label: 'Bollo', icon: '📄', badgeClass: 'badge-tax' },
  { value: 'tagliando', label: 'Tagliando', icon: '🔧', badgeClass: 'badge-maintenance' },
  { value: 'revisione', label: 'Revisione', icon: '🔍', badgeClass: 'badge-maintenance' },
  { value: 'gomme', label: 'Cambio Gomme', icon: '⚙️', badgeClass: 'badge-other' },
  { value: 'altro', label: 'Altro', icon: '📌', badgeClass: 'badge-other' }
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
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
  form.value = {
    type: 'assicurazione',
    description: '',
    expiryDate: '',
    amount: '',
    reminderDays: 30,
    notes: ''
  }
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
  return deadlineTypes.find(t => t.value === typeValue) || { label: typeValue, icon: '📌', badgeClass: 'badge-other' }
}

const canSave = computed(() => form.value.expiryDate && selectedVehicleId.value)
</script>

<template>
  <div class="deadlines">
    <!-- Vehicle selector -->
    <div v-if="vehicles.length > 0" class="vehicle-selector">
      <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
        <option v-for="v in vehicles" :key="v.id" :value="v.id">
          {{ v.name }} {{ v.plate ? `(${v.plate})` : '' }}
        </option>
      </select>
    </div>

    <!-- No vehicles -->
    <div v-if="vehicles.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary mt-16" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <!-- Form -->
    <div v-else-if="showForm" class="card">
      <h3 class="card-title" style="margin-bottom: 16px;">
        {{ editingId ? 'Modifica Scadenza' : 'Nuova Scadenza' }}
      </h3>

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

      <div class="form-group">
        <label class="form-label">Importo (€)</label>
        <input v-model="form.amount" type="number" class="form-input" placeholder="es. 450" min="0" step="0.01" />
      </div>

      <div class="form-group">
        <label class="form-label">Avviso (giorni prima)</label>
        <input v-model="form.reminderDays" type="number" class="form-input" min="1" max="365" />
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
          {{ editingId ? 'Salva' : 'Aggiungi' }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-else>
      <!-- Notifiche toggle -->
      <div v-if="notifSupported" class="notif-bar" :class="{ enabled: notifEnabled }">
        <div class="notif-bar-left">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <span>Notifiche scadenze</span>
          <span v-if="!notifSupported" class="notif-unsupported">non supportate</span>
        </div>
        <button class="toggle-switch" :class="{ on: notifEnabled }" @click="toggleNotifiche">
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <div v-if="deadlines.length === 0" class="empty-state" style="padding: 40px 0;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2>Nessuna scadenza</h2>
        <p>Aggiungi assicurazione, bollo o manutenzione</p>
      </div>

      <div v-for="dl in deadlines" :key="dl.id" class="card deadline-card" :class="statusClass(dl)">
        <div class="deadline-header">
          <div class="deadline-left">
            <span class="deadline-icon">{{ getTypeInfo(dl.type).icon }}</span>
            <div>
              <div class="deadline-title">
                <span class="badge" :class="getTypeInfo(dl.type).badgeClass">{{ getTypeInfo(dl.type).label }}</span>
                <span v-if="dl.description" class="deadline-desc">{{ dl.description }}</span>
              </div>
              <div class="deadline-date">
                {{ new Date(dl.expiryDate).toLocaleDateString('it-IT') }}
                <span v-if="dl.amount"> · {{ dl.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 }) }} €</span>
              </div>
            </div>
          </div>
          <div class="deadline-status" :class="statusClass(dl)">
            {{ statusLabel(dl) }}
          </div>
        </div>

        <div v-if="dl.notes" class="deadline-notes">{{ dl.notes }}</div>

        <div class="deadline-actions">
          <button class="btn btn-sm btn-secondary" @click="openEditForm(dl)">Modifica</button>
          <button class="btn btn-sm btn-danger" @click="confirmDelete(dl)">Elimina</button>
        </div>
      </div>

      <button class="fab" @click="openAddForm">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-chip.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.deadline-card {
  border-left: 4px solid var(--border);
}

.deadline-card.expiring {
  border-left-color: var(--warning);
}

.deadline-card.expired {
  border-left-color: var(--danger);
}

.deadline-card.ok {
  border-left-color: var(--success);
}

.deadline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.deadline-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
}

.deadline-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.deadline-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.deadline-desc {
  font-size: 14px;
  color: var(--text-secondary);
}

.deadline-date {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.deadline-status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.deadline-status.expiring {
  background: #fef3c7;
  color: #b45309;
}

.deadline-status.expired {
  background: #fee2e2;
  color: #b91c1c;
}

.deadline-status.ok {
  background: #d1fae5;
  color: #047857;
}

[data-theme="dark"] .deadline-status.expiring {
  background: #451a03;
  color: #fcd34d;
}

[data-theme="dark"] .deadline-status.expired {
  background: #450a0a;
  color: #fca5a5;
}

[data-theme="dark"] .deadline-status.ok {
  background: #064e3b;
  color: #6ee7b7;
}

.deadline-notes {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.deadline-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Notifiche bar */
.notif-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  margin-bottom: 12px;
  gap: 12px;
}
.notif-bar.enabled {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.05);
}
.notif-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.notif-bar-left svg { width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }
.notif-unsupported { font-size: 11px; color: var(--text-secondary); }

/* Toggle switch */
.toggle-switch {
  width: 44px; height: 24px;
  border-radius: 12px;
  background: var(--border);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}
.toggle-switch.on { background: #2563eb; }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.toggle-switch.on .toggle-thumb { transform: translateX(20px); }
</style>
