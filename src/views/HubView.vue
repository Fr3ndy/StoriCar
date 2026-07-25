<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useCalendarExport } from '../composables/useCalendarExport'

const router = useRouter()
const {
  data, selectedVehicleId,
  addExpense, deleteExpense, deleteAction,
  addDeadline, updateDeadline, deleteDeadline, getDeadlinesByVehicle,
  addRecurringPayment, updateRecurringPayment, deleteRecurringPayment, getRecurringPaymentsByVehicle,
  getSetting, setSetting
} = useStorage()
const { openInGoogleCalendar, exportDeadlineIcs, exportDeadlinesIcs } = useCalendarExport()

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

const DEFAULT_EXPENSE_CATEGORIES = [
  { value: 'maintenance', label: 'Manutenzione', icon: '🔧' },
  { value: 'insurance',   label: 'Assicurazione', icon: '🛡️' },
  { value: 'tax',         label: 'Bollo',          icon: '📄' },
  { value: 'tires',       label: 'Gomme',          icon: '🔩' },
  { value: 'wash',        label: 'Lavaggio',       icon: '🚿' },
  { value: 'parking',     label: 'Parcheggio',     icon: '🅿️' },
  { value: 'toll',        label: 'Pedaggi',        icon: '🛣️' },
  { value: 'fine',        label: 'Multe',          icon: '⚠️' },
  { value: 'other',       label: 'Altro',          icon: '📋' }
]
// Stessa lista gestibile usata nel form "Nuova spesa" (impostazioni condivise)
const expenseCategoryOptions = computed(() =>
  (data.value.settings?.allExpenseCategories?.length > 0)
    ? data.value.settings.allExpenseCategories
    : DEFAULT_EXPENSE_CATEGORIES
)

// ── Spese ricorrenti ─────────────────────────────────────────
const FREQUENCIES = [
  { value: 'monthly',    label: 'Mensile',     months: 1  },
  { value: 'quarterly',  label: 'Trimestrale', months: 3  },
  { value: 'semiannual', label: 'Semestrale',  months: 6  },
  { value: 'annual',     label: 'Annuale',     months: 12 },
]
function freqLabel(v)  { return FREQUENCIES.find(f => f.value === v)?.label || v }
function freqMonths(v) { return FREQUENCIES.find(f => f.value === v)?.months || 1 }

// Aggiunge N mesi a una data 'YYYY-MM-DD' gestendo la lunghezza dei mesi (es. 31 gen + 1 mese = 28/29 feb)
function addMonthsToDateStr(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + months
  const newY  = y + Math.floor(total / 12)
  const newM0 = ((total % 12) + 12) % 12
  const lastDay = new Date(newY, newM0 + 1, 0).getDate()
  const newD = Math.min(d, lastDay)
  return `${newY}-${String(newM0 + 1).padStart(2, '0')}-${String(newD).padStart(2, '0')}`
}

const recurringPayments = computed(() => {
  if (!selectedVehicleId.value) return []
  return getRecurringPaymentsByVehicle(selectedVehicleId.value)
    .slice()
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate))
})

function rpStatus(rp) {
  const d = daysUntil(rp.nextDate)
  return d < 0 ? 'expired' : d <= 7 ? 'expiring' : 'ok'
}
function rpLabel(rp) {
  const d = daysUntil(rp.nextDate)
  if (d < 0) return `Scaduta ${Math.abs(d)}gg fa`
  if (d === 0) return 'Scade oggi'
  return `tra ${d} giorni`
}

const showRpForm  = ref(false)
const editingRpId = ref(null)
const rpForm = ref({ name: '', category: 'other', amount: '', frequency: 'monthly', nextDate: '', notes: '' })

function openAddRp() {
  editingRpId.value = null
  rpForm.value = {
    name: '', category: expenseCategoryOptions.value[0]?.value || 'other',
    amount: '', frequency: 'monthly',
    nextDate: new Date().toISOString().slice(0, 10), notes: ''
  }
  showRpForm.value = true
}
function openEditRp(rp) {
  editingRpId.value = rp.id
  rpForm.value = {
    name: rp.name || '', category: rp.category || 'other',
    amount: rp.amount ?? '', frequency: rp.frequency || 'monthly',
    nextDate: rp.nextDate, notes: rp.notes || ''
  }
  showRpForm.value = true
}
async function saveRp() {
  const payload = {
    vehicleId: selectedVehicleId.value,
    name:      rpForm.value.name.trim(),
    category:  rpForm.value.category,
    amount:    rpForm.value.amount !== '' ? parseFloat(rpForm.value.amount) : null,
    frequency: rpForm.value.frequency,
    nextDate:  rpForm.value.nextDate,
    notes:     rpForm.value.notes
  }
  if (editingRpId.value) {
    await updateRecurringPayment(editingRpId.value, payload)
  } else {
    await addRecurringPayment({ ...payload, startDate: rpForm.value.nextDate })
  }
  showRpForm.value = false
}
async function confirmDeleteRp(rp) {
  if (confirm(`Eliminare la spesa ricorrente "${rp.name}"?`)) await deleteRecurringPayment(rp.id)
}

// Quante scadenze passate (incluso oggi) non sono ancora state registrate come spesa.
// Utile per chi imposta una ricorrenza già in corso da mesi (es. rata partita a dicembre):
// permette di recuperare in un colpo solo tutti i pagamenti arretrati.
function rpOverdueCount(rp) {
  const todayStr = new Date().toISOString().slice(0, 10)
  let cursor = rp.nextDate
  let count = 0
  while (cursor <= todayStr && count < 240) { // limite di sicurezza: 20 anni di mensilità
    count++
    cursor = addMonthsToDateStr(cursor, freqMonths(rp.frequency))
  }
  return count
}

// Registra la spesa nell'elenco Spese e sposta la ricorrenza alla scadenza successiva.
// Se ci sono più scadenze arretrate non ancora registrate, le genera tutte in un colpo solo
// (una spesa per ogni periodo, dalla prima scadenza non pagata fino a oggi).
async function markRecurringPaid(rp) {
  const overdue = rpOverdueCount(rp)
  if (overdue > 1) {
    const total = (rp.amount || 0) * overdue
    const ok = confirm(
      `Risultano ${overdue} scadenze non ancora registrate per "${rp.name}" ` +
      `(dal ${formatDate(rp.nextDate)} a oggi), per un totale di € ${fmt(total)}.\n\n` +
      `Vuoi registrarle tutte come spese?`
    )
    if (!ok) return
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  let cursor = rp.nextDate
  let i = 0
  while (cursor <= todayStr && i < overdue) {
    await addExpense({
      vehicleId:   rp.vehicleId,
      date:        cursor,
      category:    rp.category,
      amount:      rp.amount,
      description: rp.name,
      notes:       rp.notes || ''
    })
    cursor = addMonthsToDateStr(cursor, freqMonths(rp.frequency))
    i++
  }
  await updateRecurringPayment(rp.id, { nextDate: cursor })
}

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

// ── Export calendario (Google Calendar / .ics) ─────────────────
const openCalMenu = ref(null) // id della scadenza con il menu aperto

function currentVehicleName() {
  return vehicles.value.find(v => v.id === selectedVehicleId.value)?.name || ''
}
function toggleCalMenu(id) {
  openCalMenu.value = openCalMenu.value === id ? null : id
}
function closeCalMenu() {
  openCalMenu.value = null
}
function addDlToGoogle(dl) {
  openInGoogleCalendar(dl, getDlType(dl.type).label, currentVehicleName())
  closeCalMenu()
}
function downloadDlIcs(dl) {
  exportDeadlineIcs(dl, getDlType(dl.type).label, currentVehicleName())
  closeCalMenu()
}
function exportAllDeadlinesIcs() {
  const vehicleName = currentVehicleName()
  const items = deadlines.value.map(dl => ({ dl, typeLabel: getDlType(dl.type).label, vehicleName }))
  if (!items.length) return
  exportDeadlinesIcs(items, `scadenze-${(vehicleName || 'storicar').toLowerCase().replace(/\s+/g, '-')}.ics`)
}
function onDocClick(e) {
  if (openCalMenu.value !== null && !e.target.closest('.cal-menu-wrap')) closeCalMenu()
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

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

        <!-- ── Spese ricorrenti ── -->
        <div v-if="showRpForm" class="card form-card">
          <h3 class="form-title">{{ editingRpId ? 'Modifica spesa ricorrente' : 'Nuova spesa ricorrente' }}</h3>

          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input v-model="rpForm.name" type="text" class="form-input" placeholder="es. Rata finanziamento" />
          </div>

          <div class="form-group">
            <label class="form-label">Categoria</label>
            <div class="type-grid">
              <button
                v-for="cat in expenseCategoryOptions" :key="cat.value"
                type="button" class="type-chip"
                :class="{ active: rpForm.category === cat.value }"
                @click="rpForm.category = cat.value"
              >{{ cat.icon || '📋' }} {{ cat.label }}</button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Importo (€) *</label>
              <input v-model="rpForm.amount" type="number" class="form-input" placeholder="0.00" min="0" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Prossima scadenza *</label>
              <input v-model="rpForm.nextDate" type="date" class="form-input" />
            </div>
          </div>
          <p class="rp-hint">
            Se paghi già questa rata da tempo (es. da dicembre), inserisci qui la data del <strong>primo</strong> pagamento non ancora registrato: al salvataggio potrai generare in un colpo solo tutte le spese arretrate fino ad oggi.
          </p>

          <div class="form-group">
            <label class="form-label">Frequenza</label>
            <div class="type-grid">
              <button
                v-for="f in FREQUENCIES" :key="f.value"
                type="button" class="type-chip"
                :class="{ active: rpForm.frequency === f.value }"
                @click="rpForm.frequency = f.value"
              >{{ f.label }}</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Note</label>
            <textarea v-model="rpForm.notes" class="form-textarea" rows="2" placeholder="Note opzionali…"></textarea>
          </div>

          <div class="form-actions">
            <button class="btn btn-secondary" @click="showRpForm = false">Annulla</button>
            <button class="btn btn-primary" @click="saveRp" :disabled="!rpForm.name.trim() || !rpForm.amount || !rpForm.nextDate">
              {{ editingRpId ? 'Salva' : 'Aggiungi' }}
            </button>
          </div>
        </div>

        <div v-else class="recurring-section">
          <div class="recurring-header">
            <span class="recurring-title">🔁 Spese ricorrenti</span>
            <button class="manage-link" @click="openAddRp">+ Aggiungi</button>
          </div>

          <p v-if="recurringPayments.length === 0" class="recurring-empty">
            Nessuna spesa ricorrente (es. rata veicolo, assicurazione mensile…)
          </p>

          <div v-else class="recurring-list">
            <div v-for="rp in recurringPayments" :key="rp.id" class="card recurring-card">
              <div class="ic-top">
                <span class="dl-icon">{{ getCategoryInfo(rp.category).icon }}</span>
                <div class="dl-info">
                  <span class="ic-icon-label">{{ rp.name }}</span>
                  <span class="ic-sub-inline">{{ freqLabel(rp.frequency) }} · € {{ fmt(rp.amount) }}</span>
                </div>
                <span class="dl-badge" :class="rpStatus(rp)">{{ rpLabel(rp) }}</span>
              </div>
              <div class="recurring-actions">
                <button v-if="rpStatus(rp) !== 'ok'" class="btn btn-sm btn-primary rp-pay-btn" @click="markRecurringPaid(rp)">
                  {{ rpOverdueCount(rp) > 1 ? `✓ Segna ${rpOverdueCount(rp)} pagamenti arretrati` : '✓ Segna come pagata' }}
                </button>
                <button class="ic-btn" @click="openEditRp(rp)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="ic-btn danger" @click="confirmDeleteRp(rp)">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="section-divider"></div>

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

          <button v-if="allDeadlines.length > 0" class="btn btn-sm btn-secondary export-all-btn" @click="exportAllDeadlinesIcs">
            ⬇️ Esporta tutte (.ics)
          </button>

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
                  <div class="cal-menu-wrap">
                    <button class="ic-btn" @click.stop="toggleCalMenu(dl.id)" title="Aggiungi al calendario">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </button>
                    <div v-if="openCalMenu === dl.id" class="cal-menu" @click.stop>
                      <button class="cal-menu-item" @click="addDlToGoogle(dl)">📅 Google Calendar</button>
                      <button class="cal-menu-item" @click="downloadDlIcs(dl)">⬇️ Scarica .ics</button>
                    </div>
                  </div>
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
            <option value="expense">💸 Spese</option>
            <option value="action">🔧 Azioni</option>
          </select>
        </div>

        <div v-if="tlGrouped.length === 0" class="empty-state" style="padding:40px 0">
          <h2>Nessun evento</h2><p>Ancora nessun dato per questo periodo</p>
        </div>

        <div v-else>
          <div v-for="group in tlGrouped" :key="group.key" class="tl-group">
            <div class="tl-group-label">{{ group.label }}</div>
            <div class="card" style="padding:0;overflow:hidden">
              <div
                v-for="(item, i) in group.items"
                :key="item.id + item.type"
                class="tl-row"
                :class="{ 'tl-row-last': i === group.items.length - 1 }"
                @click="router.push(item.editPath)"
              >
                <span class="tl-type-dot" :class="'dot-' + item.type"></span>
                <div class="tl-row-info">
                  <div class="tl-row-title">{{ item.title }}</div>
                  <div v-if="item.sub" class="tl-row-sub">{{ item.sub }}</div>
                </div>
                <div class="tl-row-right">
                  <span class="tl-row-date">{{ new Date(item.date).toLocaleDateString('it-IT', { day:'2-digit', month:'short' }) }}</span>
                  <span v-if="item.time" class="tl-row-time">{{ item.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </template>
  </div>
</template>

<style scoped>
.view-container { padding: 0 0 100px; }

/* ── Tabs ── */
.hub-tabs {
  display: flex; gap: 0; margin-bottom: 14px;
  background: var(--bg-secondary); border-radius: var(--r);
  padding: 3px; border: 1px solid var(--border);
}
.hub-tab {
  flex: 1; padding: 8px 4px; text-align: center;
  border-radius: var(--r-sm); font-size: 12px; font-weight: 600;
  color: var(--text-secondary); background: transparent; border: none;
  cursor: pointer; transition: all .15s;
}
.hub-tab.active {
  background: var(--bg-card); color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

/* ── Item card ── */
.item-list { display: flex; flex-direction: column; gap: 6px; }
.item-card { padding: 12px 14px; cursor: pointer; transition: background .12s; }
.item-card:active { background: var(--bg-secondary); }

.ic-top   { display: flex; align-items: center; gap: 8px; }
.ic-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
.ic-icon-label { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.ic-date  { font-size: 11px; color: var(--text-tertiary); flex-shrink: 0; margin-left: auto; }
.ic-amount { font-size: 14px; font-weight: 700; color: var(--text-primary); flex-shrink: 0; }
.ic-sub   { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

/* ── Icona emoji spesa ── */
.ic-emoji { font-size: 18px; line-height: 1; flex-shrink: 0; }

/* ── Scadenze ── */
.form-card   { padding: 18px 16px; margin-bottom: 10px; }
.form-title  { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; }
.form-row    { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }

/* Intestazione tipo + link gestisci */
.cat-header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.manage-link { background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; }

/* Chip grid tipo */
.type-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.type-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 11px; border-radius: 20px;
  border: 1.5px solid var(--border); background: var(--bg-secondary);
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.type-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

/* Manage panel */
.manage-panel { border: 1px solid var(--border); border-radius: var(--r); padding: 10px 12px; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.manage-row   { display: flex; gap: 6px; align-items: center; }
.type-icon-sm { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
.manage-input { flex: 1; font-size: 13px; padding: 6px 10px; }
.icon-input   { width: 42px; flex-shrink: 0; text-align: center; font-size: 15px; padding: 6px 4px; }
.manage-del   { width: 28px; height: 28px; border-radius: var(--r-sm); background: none; border: 1px solid var(--border); color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.manage-del:disabled { opacity: .3; cursor: not-allowed; }
.manage-del svg { width: 12px; height: 12px; }
.manage-add-row { display: flex; gap: 6px; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--border); }
.reset-link  { background: none; border: none; font-size: 11px; color: var(--text-tertiary); cursor: pointer; text-align: left; padding: 2px 0; text-decoration: underline; }

/* Filtro tipo */
.type-filter-bar { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; margin-bottom: 6px; }
.type-filter-bar::-webkit-scrollbar { display: none; }
.type-filter-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 11px; border-radius: 20px;
  border: 1.5px solid var(--border); background: var(--bg-secondary);
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  white-space: nowrap; cursor: pointer; transition: all 0.15s; flex-shrink: 0;
}
.type-filter-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
.filter-count { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px; background: rgba(0,0,0,0.1); }
.type-filter-chip.active .filter-count { background: rgba(255,255,255,0.25); }

.dl-card .ic-top { gap: 10px; align-items: flex-start; }
.dl-icon     { font-size: 20px; flex-shrink: 0; padding-top: 1px; }
.dl-info     { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ic-sub-inline { font-size: 12px; color: var(--text-secondary); }
.dl-badge    { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; background: var(--bg-secondary); color: var(--text-secondary); }
.dl-badge.expiring { background: rgba(245,158,11,0.12); color: #b45309; }
.dl-badge.expired  { background: rgba(239,68,68,0.10);  color: #b91c1c; }
.dl-btns   { display: flex; gap: 3px; }
.ic-btn    { width: 28px; height: 28px; border-radius: var(--r-sm); background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ic-btn svg { width: 13px; height: 13px; }
.ic-btn.danger { color: var(--danger); }

/* Menu "aggiungi al calendario" */
.cal-menu-wrap { position: relative; }
.cal-menu {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 20;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-sm);
  box-shadow: var(--shadow-sm); padding: 4px; display: flex; flex-direction: column; gap: 2px;
  min-width: 168px;
}
.cal-menu-item {
  background: none; border: none; text-align: left; padding: 8px 10px; border-radius: 6px;
  font-size: 12.5px; font-weight: 500; color: var(--text-primary); cursor: pointer; white-space: nowrap;
}
.cal-menu-item:hover, .cal-menu-item:active { background: var(--bg-secondary); }

.export-all-btn { width: 100%; margin-bottom: 10px; }

/* ── Spese ricorrenti ── */
.recurring-section { margin-bottom: 4px; }
.recurring-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.recurring-title  { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.recurring-empty  { font-size: 12.5px; color: var(--text-secondary); padding: 2px 2px 4px; }
.recurring-list   { display: flex; flex-direction: column; gap: 6px; }
.recurring-card   { padding: 12px 14px; }
.recurring-card .ic-top { gap: 10px; align-items: flex-start; }
.recurring-actions {
  display: flex; align-items: center; gap: 7px;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
}
.rp-pay-btn { flex: 1; }

.rp-hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  margin: -6px 0 14px;
}

.section-divider { height: 1px; background: var(--border); margin: 4px 0 16px; }

/* ── Timeline ── */
.tl-filters { display: flex; gap: 6px; margin-bottom: 12px; }
.tl-sel     { flex: 1; font-size: 12px; padding: 7px 8px; }

.tl-group { margin-bottom: 14px; }
.tl-group-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-tertiary); margin-bottom: 6px; padding: 0 2px;
}

.tl-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-bottom: 1px solid var(--border);
  cursor: pointer; transition: background .12s;
}
.tl-row:active      { background: var(--bg-secondary); }
.tl-row-last        { border-bottom: none; }

.tl-type-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
}
.dot-fuel    { background: #111; }
.dot-expense { background: #f59e0b; }
.dot-action  { background: #10b981; }
[data-theme="dark"] .dot-fuel { background: #f0f0f0; }

.tl-row-info  { flex: 1; min-width: 0; }
.tl-row-title { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-row-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }

.tl-row-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.tl-row-date  { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
.tl-row-time  { font-size: 10px; color: var(--text-tertiary); }
</style>
