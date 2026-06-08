<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const {
  data, selectedVehicleId,
  deleteExpense, deleteAction,
  addDeadline, updateDeadline, deleteDeadline, getDeadlinesByVehicle,
  getSetting, setSetting
} = useStorage()

const activeTab = ref('spese') // spese | azioni | scadenze | timeline

const vehicles    = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)

// ── Categorie spese ───────────────────────────────────────────
const builtinCategories = {
  maintenance: { label: 'Manutenzione', color: '#f59e0b', icon: '🔧' },
  insurance:   { label: 'Assicurazione', color: '#6366f1', icon: '🛡️' },
  tax:         { label: 'Bollo',          color: '#ef4444', icon: '📄' },
  tires:       { label: 'Gomme',          color: '#f97316', icon: '🔩' },
  wash:        { label: 'Lavaggio',       color: '#06b6d4', icon: '🚿' },
  parking:     { label: 'Parcheggio',     color: '#8b5cf6', icon: '🅿️' },
  toll:        { label: 'Pedaggi',        color: '#64748b', icon: '🛣️' },
  fine:        { label: 'Multe',          color: '#dc2626', icon: '⚠️' },
  other:       { label: 'Altro',          color: '#64748b', icon: '📋' }
}
function getCategoryInfo(v) {
  const managed = data.value.settings?.allExpenseCategories || []
  if (managed.length) {
    const m = managed.find(x => x.value === v)
    if (m) return {
      label: m.label,
      icon:  m.icon  || builtinCategories[v]?.icon  || '📋',
      color: builtinCategories[v]?.color || '#64748b'
    }
  }
  if (builtinCategories[v]) return builtinCategories[v]
  const c = (data.value.settings?.customCategories || []).find(x => x.value === v)
  return c || builtinCategories.other
}

// ── Tipi azione ───────────────────────────────────────────────
const builtinActionTypes = {
  acqua_radiatore:  { label: 'Acqua radiatore',    icon: '💧' },
  olio_motore:      { label: 'Olio motore',        icon: '🛢️' },
  pressione_gomme:  { label: 'Pressione gomme',    icon: '🔧' },
  lavaggio:         { label: 'Lavaggio',           icon: '🚿' },
  filtro_aria:      { label: 'Filtro aria',        icon: '💨' },
  luci:             { label: 'Controllo luci',     icon: '💡' },
  batteria:         { label: 'Controllo batteria', icon: '🔋' },
  freni:            { label: 'Controllo freni',    icon: '🛑' },
  liquido_freni:    { label: 'Liquido freni',      icon: '🧪' },
  antigelo:         { label: 'Antigelo',           icon: '❄️' },
  altro:            { label: 'Altro',              icon: '📋' },
}
function getActionType(v) {
  const managed = data.value.settings?.allActionTypes || []
  if (managed.length) {
    const m = managed.find(x => x.value === v)
    if (m) return { label: m.label, icon: m.icon || '📋' }
  }
  if (builtinActionTypes[v]) return builtinActionTypes[v]
  const c = (data.value.settings?.customActionTypes || []).find(x => x.value === v)
  return c ? { label: c.label, icon: c.icon || '📋' } : { label: v, icon: '📋' }
}

// ── Spese ─────────────────────────────────────────────────────
const expenses = computed(() => {
  if (!selectedVehicleId.value) return []
  return data.value.expenses
    .filter(e => e.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// ── Azioni ────────────────────────────────────────────────────
const actions = computed(() => {
  if (!selectedVehicleId.value) return []
  return (data.value.actions || [])
    .filter(a => a.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

// ── Scadenze ──────────────────────────────────────────────────
const DEFAULT_DEADLINE_TYPES = [
  { value: 'assicurazione', label: 'Assicurazione', icon: '🛡️' },
  { value: 'bollo',         label: 'Bollo',         icon: '📄' },
  { value: 'tagliando',     label: 'Tagliando',     icon: '🔧' },
  { value: 'revisione',     label: 'Revisione',     icon: '🔍' },
  { value: 'gomme',         label: 'Cambio Gomme',  icon: '⚙️' },
  { value: 'altro',         label: 'Altro',         icon: '📌' },
]
const deadlineTypes = computed(() =>
  (data.value.settings?.allDeadlineTypes?.length > 0)
    ? data.value.settings.allDeadlineTypes
    : DEFAULT_DEADLINE_TYPES
)
function getDlType(v) { return deadlineTypes.value.find(t => t.value === v) || { label: v, icon: '📌' } }

const allDeadlines = computed(() => {
  if (!selectedVehicleId.value) return []
  return getDeadlinesByVehicle(selectedVehicleId.value)
})
const dlTypeFilter = ref(null) // null = tutte
const deadlines = computed(() =>
  dlTypeFilter.value
    ? allDeadlines.value.filter(dl => dl.type === dlTypeFilter.value)
    : allDeadlines.value
)
const activeDlTypes = computed(() =>
  deadlineTypes.value.filter(t => allDeadlines.value.some(dl => dl.type === t.value))
)

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((new Date(dateStr) - today) / 86400000)
}
function dlStatus(dl) {
  const d = daysUntil(dl.expiryDate)
  return d < 0 ? 'expired' : d <= (dl.reminderDays || 30) ? 'expiring' : 'ok'
}
function dlLabel(dl) {
  const d = daysUntil(dl.expiryDate)
  if (d < 0) return `Scaduta ${Math.abs(d)}gg fa`
  if (d === 0) return 'Scade oggi'
  return `${d} giorni`
}

// ── Gestione tipi scadenza ────────────────────────────────────
const showDlManage   = ref(false)
const dlEditLabels   = ref({})
const dlNewLabel     = ref('')
const dlNewIcon      = ref('📌')

function openDlManage() {
  if (!data.value.settings?.allDeadlineTypes?.length) {
    setSetting('allDeadlineTypes', DEFAULT_DEADLINE_TYPES.map(t => ({ ...t })))
  }
  dlEditLabels.value = {}
  deadlineTypes.value.forEach(t => { dlEditLabels.value[t.value] = t.label })
  showDlManage.value = true
}
async function saveDlLabel(type) {
  const newLabel = (dlEditLabels.value[type.value] || '').trim()
  if (!newLabel || newLabel === type.label) return
  await setSetting('allDeadlineTypes', deadlineTypes.value.map(t => t.value === type.value ? { ...t, label: newLabel } : t))
}
async function deleteDlType(type) {
  if (deadlineTypes.value.length <= 1) return
  const updated = deadlineTypes.value.filter(t => t.value !== type.value)
  await setSetting('allDeadlineTypes', updated)
  if (dlForm.value.type === type.value) dlForm.value.type = updated[0]?.value || ''
}
async function addDlType() {
  const label = dlNewLabel.value.trim()
  if (!label) return
  const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString(36)
  const updated = [...deadlineTypes.value, { value, label, icon: dlNewIcon.value || '📌' }]
  await setSetting('allDeadlineTypes', updated)
  dlEditLabels.value[value] = label
  dlForm.value.type = value
  dlNewLabel.value = ''
  dlNewIcon.value = '📌'
}
async function resetDlTypes() {
  if (!confirm('Ripristinare i tipi predefiniti?')) return
  await setSetting('allDeadlineTypes', DEFAULT_DEADLINE_TYPES.map(t => ({ ...t })))
  dlEditLabels.value = {}
  DEFAULT_DEADLINE_TYPES.forEach(t => { dlEditLabels.value[t.value] = t.label })
}

// ── Form scadenza inline ──────────────────────────────────────
const showDlForm  = ref(false)
const editingDlId = ref(null)
const dlForm = ref({ type: 'assicurazione', description: '', expiryDate: '', amount: '', reminderDays: 30, notes: '' })

function openAddDl() {
  editingDlId.value = null
  showDlManage.value = false
  dlForm.value = { type: deadlineTypes.value[0]?.value || 'assicurazione', description: '', expiryDate: '', amount: '', reminderDays: 30, notes: '' }
  showDlForm.value = true
}
function openEditDl(dl) {
  editingDlId.value = dl.id
  showDlManage.value = false
  dlForm.value = { type: dl.type, description: dl.description || '', expiryDate: dl.expiryDate, amount: dl.amount || '', reminderDays: dl.reminderDays || 30, notes: dl.notes || '' }
  showDlForm.value = true
}
async function saveDl() {
  const payload = { vehicleId: selectedVehicleId.value, type: dlForm.value.type, description: dlForm.value.description, expiryDate: dlForm.value.expiryDate, amount: dlForm.value.amount ? parseFloat(dlForm.value.amount) : null, reminderDays: parseInt(dlForm.value.reminderDays) || 30, notes: dlForm.value.notes }
  if (editingDlId.value) { await updateDeadline(editingDlId.value, payload) }
  else { await addDeadline(payload) }
  showDlForm.value = false
}
async function confirmDeleteDl(dl) {
  if (confirm(`Eliminare "${getDlType(dl.type).label}"?`)) await deleteDeadline(dl.id)
}

// ── Timeline ──────────────────────────────────────────────────
const tlFilterYear  = ref('')
const tlFilterMonth = ref('')
const tlFilterType  = ref('') // '' | 'fuel' | 'expense' | 'action'

const timelineItems = computed(() => {
  if (!selectedVehicleId.value) return []
  const vid = selectedVehicleId.value
  const fuel = data.value.fuelRecords.filter(r => r.vehicleId === vid).map(r => ({
    id: r.id, type: 'fuel', date: r.date, time: r.time,
    title: `Rifornimento — ${r.amount != null ? '€ ' + r.amount.toFixed(2).replace('.', ',') : ''}`,
    sub: [r.liters != null ? r.liters.toFixed(2).replace('.', ',') + ' L' : null, r.pricePerLiter != null ? r.pricePerLiter.toFixed(3).replace('.', ',') + ' €/L' : null, r.kmDriven ? Math.round(r.kmDriven) + ' km' : null].filter(Boolean).join(' · '),
    icon: '⛽', editPath: `/fuel/edit/${r.id}`
  }))
  const exp = data.value.expenses.filter(e => e.vehicleId === vid).map(e => ({
    id: e.id, type: 'expense', date: e.date, time: null,
    title: `${getCategoryInfo(e.category).label} — € ${e.amount != null ? e.amount.toFixed(2).replace('.', ',') : ''}`,
    sub: e.description || '',
    icon: '💸', editPath: `/expenses/edit/${e.id}`
  }))
  const act = (data.value.actions || []).filter(a => a.vehicleId === vid).map(a => ({
    id: a.id, type: 'action', date: a.date, time: null,
    title: getActionType(a.type).icon + ' ' + getActionType(a.type).label + (a.cost != null ? ` — € ${a.cost.toFixed(2).replace('.', ',')}` : ''),
    sub: [a.odometer ? a.odometer.toLocaleString('it-IT') + ' km' : null, a.notes].filter(Boolean).join(' · '),
    icon: getActionType(a.type).icon, editPath: `/actions/edit/${a.id}`
  }))
  let all = [...fuel, ...exp, ...act]
  if (tlFilterType.value) all = all.filter(i => i.type === tlFilterType.value)
  if (tlFilterYear.value) all = all.filter(i => new Date(i.date).getFullYear() === parseInt(tlFilterYear.value))
  if (tlFilterMonth.value) all = all.filter(i => (new Date(i.date).getMonth() + 1) === parseInt(tlFilterMonth.value))
  return all.sort((a, b) => {
    const da = a.date + (a.time || ''), db = b.date + (b.time || '')
    return da < db ? 1 : -1
  })
})

const tlMonths = [
  { v: '1', l: 'Gen' }, { v: '2', l: 'Feb' }, { v: '3', l: 'Mar' },
  { v: '4', l: 'Apr' }, { v: '5', l: 'Mag' }, { v: '6', l: 'Giu' },
  { v: '7', l: 'Lug' }, { v: '8', l: 'Ago' }, { v: '9', l: 'Set' },
  { v: '10', l: 'Ott' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dic' },
]
const tlYears = computed(() => {
  const all = timelineItems.value.map(i => new Date(i.date).getFullYear())
  return [...new Set(all)].sort((a, b) => b - a)
})

// Raggruppa per mese
const tlGrouped = computed(() => {
  const groups = {}
  for (const item of timelineItems.value) {
    const d = new Date(item.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { key, label, items: [] }
    groups[key].items.push(item)
  }
  return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key))
})

// ── Utils ─────────────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmt(n, d = 2) { return n != null ? n.toFixed(d).replace('.', ',') : '—' }
</script>

<template>
  <div class="view-container">

    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <template v-else>

      <!-- Tab selector -->
      <div class="hub-tabs">
        <button class="hub-tab" :class="{ active: activeTab === 'spese' }"    @click="activeTab = 'spese'">Spese</button>
        <button class="hub-tab" :class="{ active: activeTab === 'azioni' }"   @click="activeTab = 'azioni'">Azioni</button>
        <button class="hub-tab" :class="{ active: activeTab === 'scadenze' }" @click="activeTab = 'scadenze'">Scadenze</button>
        <button class="hub-tab" :class="{ active: activeTab === 'timeline' }" @click="activeTab = 'timeline'">Timeline</button>
      </div>

      <!-- ══ SPESE ══ -->
      <template v-if="activeTab === 'spese'">
        <div v-if="expenses.length === 0" class="empty-state" style="padding:40px 0">
          <h2>Nessuna spesa</h2><p>Aggiungi la prima spesa</p>
        </div>
        <div v-else class="item-list">
          <div v-for="e in expenses" :key="e.id" class="card item-card" @click="router.push(`/expenses/edit/${e.id}`)">
            <div class="ic-top">
              <span class="ic-emoji">{{ getCategoryInfo(e.category).icon }}</span>
              <span class="ic-badge" :style="{ background: getCategoryInfo(e.category).color + '18', color: getCategoryInfo(e.category).color }">
                {{ getCategoryInfo(e.category).label }}
              </span>
              <span class="ic-date">{{ formatDate(e.date) }}</span>
              <span class="ic-amount">€ {{ fmt(e.amount) }}</span>
            </div>
            <div v-if="e.description" class="ic-sub">{{ e.description }}</div>
          </div>
        </div>
        <button class="fab" @click="router.push('/expenses/add')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        </button>
      </template>

      <!-- ══ AZIONI ══ -->
      <template v-else-if="activeTab === 'azioni'">
        <div v-if="actions.length === 0" class="empty-state" style="padding:40px 0">
          <h2>Nessuna azione</h2><p>Registra manutenzioni e controlli</p>
        </div>
        <div v-else class="item-list">
          <div v-for="a in actions" :key="a.id" class="card item-card" @click="router.push(`/actions/edit/${a.id}`)">
            <div class="ic-top">
              <span class="ic-icon-label">{{ getActionType(a.type).icon }} {{ getActionType(a.type).label }}</span>
              <span class="ic-date">{{ formatDate(a.date) }}</span>
              <span v-if="a.cost != null" class="ic-amount">€ {{ fmt(a.cost) }}</span>
            </div>
            <div v-if="a.odometer || a.notes" class="ic-sub">
              <span v-if="a.odometer">{{ a.odometer.toLocaleString('it-IT') }} km</span>
              <span v-if="a.odometer && a.notes"> · </span>
              <span v-if="a.notes">{{ a.notes }}</span>
            </div>
          </div>
        </div>
        <button class="fab" @click="router.push('/actions/add')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        </button>
      </template>

      <!-- ══ SCADENZE ══ -->
      <template v-else-if="activeTab === 'scadenze'">

        <!-- Form inline scadenza -->
        <div v-if="showDlForm" class="card form-card">
          <h3 class="form-title">{{ editingDlId ? 'Modifica scadenza' : 'Nuova scadenza' }}</h3>

          <!-- Tipo con chip grid + gestisci -->
          <div class="form-group">
            <div class="cat-header">
              <label class="form-label" style="margin:0">Tipo *</label>
              <button class="manage-link" @click="showDlManage ? showDlManage = false : openDlManage()">
                {{ showDlManage ? 'Chiudi' : '⚙ Gestisci' }}
              </button>
            </div>

            <div v-if="!showDlManage" class="type-grid">
              <button
                v-for="t in deadlineTypes" :key="t.value"
                type="button" class="type-chip"
                :class="{ active: dlForm.type === t.value }"
                @click="dlForm.type = t.value"
              >{{ t.icon }} {{ t.label }}</button>
            </div>

            <div v-else class="manage-panel">
              <div v-for="type in deadlineTypes" :key="type.value" class="manage-row">
                <span class="type-icon-sm">{{ type.icon }}</span>
                <input
                  v-model="dlEditLabels[type.value]"
                  type="text" class="form-input manage-input"
                  @blur="saveDlLabel(type)" @keyup.enter="saveDlLabel(type)"
                />
                <button class="manage-del" @click="deleteDlType(type)" :disabled="deadlineTypes.length <= 1" title="Elimina">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
              <div class="manage-add-row">
                <input v-model="dlNewIcon" type="text" class="form-input icon-input" placeholder="📌" maxlength="2" />
                <input v-model="dlNewLabel" type="text" class="form-input manage-input" placeholder="Nuovo tipo…" @keyup.enter="addDlType" />
                <button class="btn btn-sm btn-primary" :disabled="!dlNewLabel.trim()" @click="addDlType">+</button>
              </div>
              <button class="reset-link" @click="resetDlTypes">↺ Ripristina predefiniti</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Descrizione</label>
            <input v-model="dlForm.description" type="text" class="form-input" placeholder="es. Compagnia XYZ" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Scadenza *</label>
              <input v-model="dlForm.expiryDate" type="date" class="form-input" required />
            </div>
            <div class="form-group">
              <label class="form-label">Importo (€)</label>
              <input v-model="dlForm.amount" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Avvisa (giorni prima)</label>
            <input v-model="dlForm.reminderDays" type="number" class="form-input" min="1" max="365" />
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="showDlForm = false">Annulla</button>
            <button class="btn btn-primary" @click="saveDl" :disabled="!dlForm.expiryDate">
              {{ editingDlId ? 'Salva' : 'Aggiungi' }}
            </button>
          </div>
        </div>

        <template v-else>
          <!-- Filtro per tipo -->
          <div v-if="allDeadlines.length > 0" class="type-filter-bar">
            <button class="type-filter-chip" :class="{ active: dlTypeFilter === null }" @click="dlTypeFilter = null">
              Tutte <span class="filter-count">{{ allDeadlines.length }}</span>
            </button>
            <button
              v-for="t in activeDlTypes" :key="t.value"
              class="type-filter-chip" :class="{ active: dlTypeFilter === t.value }"
              @click="dlTypeFilter = dlTypeFilter === t.value ? null : t.value"
            >
              {{ t.icon }} {{ t.label }}
              <span class="filter-count">{{ allDeadlines.filter(dl => dl.type === t.value).length }}</span>
            </button>
          </div>

          <div v-if="deadlines.length === 0" class="empty-state" style="padding:40px 0">
            <h2>Nessuna scadenza</h2><p>Aggiungi la prima scadenza</p>
          </div>
          <div v-else class="item-list">
            <div v-for="dl in deadlines" :key="dl.id" class="card item-card dl-card">
              <div class="ic-top">
                <span class="dl-icon">{{ getDlType(dl.type).icon }}</span>
                <div class="dl-info">
                  <span class="ic-icon-label">{{ getDlType(dl.type).label }}</span>
                  <span v-if="dl.description" class="ic-sub-inline">{{ dl.description }}</span>
                </div>
                <span class="dl-badge" :class="dlStatus(dl)">{{ dlLabel(dl) }}</span>
                <div class="dl-btns">
                  <button class="ic-btn" @click.stop="openEditDl(dl)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button class="ic-btn danger" @click.stop="confirmDeleteDl(dl)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button class="fab" @click="openAddDl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          </button>
        </template>
      </template>

      <!-- ══ TIMELINE ══ -->
      <template v-else-if="activeTab === 'timeline'">
        <!-- Filtri -->
        <div class="tl-filters">
          <select v-model="tlFilterYear" class="form-select tl-sel">
            <option value="">Tutti gli anni</option>
            <option v-for="y in tlYears" :key="y" :value="y">{{ y }}</option>
          </select>
          <select v-model="tlFilterMonth" class="form-select tl-sel">
            <option value="">Tutti i mesi</option>
            <option v-for="m in tlMonths" :key="m.v" :value="m.v">{{ m.l }}</option>
          </select>
          <select v-model="tlFilterType" class="form-select tl-sel">
            <option value="">Tutto</option>
            <option value="fuel">⛽ Carburante</option>
            <option value="expense">💸 Spese</optio