<script setup>
import { ref, computed, watch } from 'vue'
import { useStorage } from '../composables/useStorage'

const {
  data, dataReady,
  getDefaultVehicleId, setDefaultVehicle,
  addRecurringPayment, updateRecurringPayment, deleteRecurringPayment,
  getRecurringPaymentsByVehicle
} = useStorage()

const selectedVehicleId = ref(null)
const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)
const defaultVehicleId = computed(() => data.value.settings?.defaultVehicleId)

watch(dataReady, (ready) => {
  if (!ready) return
  const defaultId = getDefaultVehicleId()
  if (defaultId && vehicles.value.find(v => v.id === defaultId)) {
    selectedVehicleId.value = defaultId
  } else if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }
}, { immediate: true })

async function onVehicleChange(e) {
  selectedVehicleId.value = e.target.value
  await setDefaultVehicle(e.target.value)
}

// ── Payments list ──────────────────────────────────────────────
const payments = computed(() => {
  if (!selectedVehicleId.value) return []
  return getRecurringPaymentsByVehicle(selectedVehicleId.value)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
})

const totalMonthly = computed(() => {
  return payments.value.reduce((sum, p) => {
    return sum + toMonthly(p.amount, p.frequency)
  }, 0)
})

const totalYearly = computed(() => totalMonthly.value * 12)

function toMonthly(amount, frequency) {
  if (!amount) return 0
  switch (frequency) {
    case 'weekly':   return amount * 4.333
    case 'monthly':  return amount
    case 'bimonthly': return amount / 2
    case 'quarterly': return amount / 3
    case 'semiannual': return amount / 6
    case 'annual':   return amount / 12
    default: return amount
  }
}

function fmt(num, dec = 2) {
  if (num == null || isNaN(num)) return '-'
  return num.toFixed(dec).replace('.', ',')
}

const frequencyLabels = {
  weekly:     'Settimanale',
  monthly:    'Mensile',
  bimonthly:  'Bimestrale',
  quarterly:  'Trimestrale',
  semiannual: 'Semestrale',
  annual:     'Annuale'
}

const categoryOptions = [
  { value: 'financing', label: 'Finanziamento', icon: '🏦' },
  { value: 'insurance', label: 'Assicurazione', icon: '🛡️' },
  { value: 'leasing',   label: 'Leasing',       icon: '🔑' },
  { value: 'parking',   label: 'Abbonamento parcheggio', icon: '🅿️' },
  { value: 'toll',      label: 'Pedaggi/Vignette', icon: '🛣️' },
  { value: 'other',     label: 'Altro',           icon: '📌' }
]

function getCategoryIcon(val) {
  return categoryOptions.find(c => c.value === val)?.icon || '📌'
}
function getCategoryLabel(val) {
  return categoryOptions.find(c => c.value === val)?.label || val
}

// ── Form ──────────────────────────────────────────────────────
const showForm = ref(false)
const editingId = ref(null)

const form = ref({
  name: '',
  category: 'financing',
  amount: '',
  frequency: 'monthly',
  startDate: '',
  endDate: '',
  notes: '',
  totalInstallments: '',
  paidInstallments: ''
})

function resetForm() {
  form.value = {
    name: '', category: 'financing', amount: '', frequency: 'monthly',
    startDate: '', endDate: '', notes: '', totalInstallments: '', paidInstallments: ''
  }
  editingId.value = null
}

function openAdd() {
  resetForm()
  showForm.value = true
}

function openEdit(p) {
  editingId.value = p.id
  form.value = {
    name: p.name || '',
    category: p.category || 'financing',
    amount: p.amount || '',
    frequency: p.frequency || 'monthly',
    startDate: p.startDate || '',
    endDate: p.endDate || '',
    notes: p.notes || '',
    totalInstallments: p.totalInstallments || '',
    paidInstallments: p.paidInstallments || ''
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  resetForm()
}

async function save() {
  if (!form.value.name || !form.value.amount) return
  const payload = {
    vehicleId: selectedVehicleId.value,
    name: form.value.name.trim(),
    category: form.value.category,
    amount: parseFloat(form.value.amount),
    frequency: form.value.frequency,
    startDate: form.value.startDate || null,
    endDate: form.value.endDate || null,
    notes: form.value.notes.trim() || null,
    totalInstallments: form.value.totalInstallments ? parseInt(form.value.totalInstallments) : null,
    paidInstallments: form.value.paidInstallments ? parseInt(form.value.paidInstallments) : null
  }
  if (editingId.value) {
    await updateRecurringPayment(editingId.value, payload)
  } else {
    await addRecurringPayment(payload)
  }
  closeForm()
}

async function confirmDelete(id) {
  if (confirm('Eliminare questo pagamento ricorrente?')) {
    await deleteRecurringPayment(id)
  }
}

// Calcola rate residue / stato finanziamento
function installmentsLeft(p) {
  if (!p.totalInstallments || !p.paidInstallments) return null
  return p.totalInstallments - p.paidInstallments
}

function installmentProgress(p) {
  if (!p.totalInstallments || !p.paidInstallments) return null
  return Math.min((p.paidInstallments / p.totalInstallments) * 100, 100)
}

function isExpiringSoon(p) {
  if (!p.endDate) return false
  const days = (new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function isExpired(p) {
  if (!p.endDate) return false
  return new Date(p.endDate) < new Date()
}
</script>

<template>
  <div class="rp-view">

    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
    </div>

    <div v-else>

      <!-- Vehicle selector -->
      <div class="vehicle-selector">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.id === defaultVehicleId ? '★ ' : '' }}{{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Summary cards -->
      <div class="summary-row" v-if="payments.length > 0">
        <div class="summary-card">
          <div class="summary-val">{{ fmt(totalMonthly) }} €</div>
          <div class="summary-lbl">al mese</div>
        </div>
        <div class="summary-card">
          <div class="summary-val">{{ fmt(totalYearly) }} €</div>
          <div class="summary-lbl">all'anno</div>
        </div>
        <div class="summary-card">
          <div class="summary-val">{{ payments.length }}</div>
          <div class="summary-lbl">pagamenti</div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="payments.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <h2>Nessun pagamento</h2>
        <p>Aggiungi finanziamenti, assicurazioni e altri pagamenti fissi</p>
      </div>

      <!-- Payments list -->
      <div v-else class="payments-list">
        <div
          v-for="p in payments"
          :key="p.id"
          class="payment-card"
          :class="{ expired: isExpired(p), expiring: isExpiringSoon(p) }"
        >
          <div class="payment-top">
            <div class="payment-icon">{{ getCategoryIcon(p.category) }}</div>
            <div class="payment-info">
              <div class="payment-name">{{ p.name }}</div>
              <div class="payment-category">{{ getCategoryLabel(p.category) }} · {{ frequencyLabels[p.frequency] || p.frequency }}</div>
            </div>
            <div class="payment-amount">
              <div class="amount-main">{{ fmt(p.amount) }} €</div>
              <div class="amount-monthly" v-if="p.frequency !== 'monthly'">
                ≈ {{ fmt(toMonthly(p.amount, p.frequency)) }} €/m
              </div>
            </div>
          </div>

          <!-- Progress bar for installments -->
          <div class="installment-section" v-if="p.totalInstallments">
            <div class="installment-header">
              <span>Rata {{ p.paidInstallments || 0 }} / {{ p.totalInstallments }}</span>
              <span v-if="installmentsLeft(p) !== null" :class="installmentsLeft(p) <= 3 ? 'text-success' : 'text-muted'">
                {{ installmentsLeft(p) }} rimast{{ installmentsLeft(p) === 1 ? 'a' : 'e' }}
              </span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (installmentProgress(p) || 0) + '%' }"></div>
            </div>
          </div>

          <!-- Dates -->
          <div class="payment-dates" v-if="p.startDate || p.endDate">
            <span v-if="p.startDate">Dal {{ new Date(p.startDate).toLocaleDateString('it-IT') }}</span>
            <span v-if="p.endDate">
              <span v-if="isExpired(p)" class="badge-expired">Scaduto {{ new Date(p.endDate).toLocaleDateString('it-IT') }}</span>
              <span v-else-if="isExpiringSoon(p)" class="badge-expiring">Scade {{ new Date(p.endDate).toLocaleDateString('it-IT') }}</span>
              <span v-else>fino al {{ new Date(p.endDate).toLocaleDateString('it-IT') }}</span>
            </span>
          </div>

          <div v-if="p.notes" class="payment-notes">{{ p.notes }}</div>

          <!-- Actions -->
          <div class="payment-actions">
            <button class="btn-icon-sm" @click="openEdit(p)" title="Modifica">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="btn-icon-sm danger" @click="confirmDelete(p.id)" title="Elimina">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- FAB -->
      <button class="fab" @click="openAdd">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>

    </div>

    <!-- ── Form modal ── -->
    <Transition name="modal">
      <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
        <div class="modal-sheet">
          <div class="modal-header">
            <h3>{{ editingId ? 'Modifica pagamento' : 'Nuovo pagamento ricorrente' }}</h3>
            <button class="modal-close" @click="closeForm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nome *</label>
              <input v-model="form.name" type="text" class="form-input" placeholder="es. Finanziamento BMW" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Categoria</label>
                <select v-model="form.category" class="form-select">
                  <option v-for="c in categoryOptions" :key="c.value" :value="c.value">
                    {{ c.icon }} {{ c.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Frequenza</label>
                <select v-model="form.frequency" class="form-select">
                  <option v-for="(label, val) in frequencyLabels" :key="val" :value="val">{{ label }}</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Importo (€) *</label>
              <input v-model="form.amount" type="number" step="0.01" class="form-input" placeholder="0,00" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Data inizio</label>
                <input v-model="form.startDate" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Data fine</label>
                <input v-model="form.endDate" type="date" class="form-input" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Rate totali</label>
                <input v-model="form.totalInstallments" type="number" class="form-input" placeholder="es. 48" />
              </div>
              <div class="form-group">
                <label class="form-label">Rate pagate</label>
                <input v-model="form.paidInstallments" type="number" class="form-input" placeholder="es. 12" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Note</label>
              <input v-model="form.notes" type="text" class="form-input" placeholder="Informazioni aggiuntive..." />
            </div>

            <div class="form-actions">
              <button class="btn btn-secondary" @click="closeForm">Annulla</button>
              <button class="btn btn-primary" @click="save" :disabled="!form.name || !form.amount">Salva</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* Root container */
.rp-view {
  padding: 0 0 100px;
}

.vehicle-selector {
  padding: 0 16px;
  margin-bottom: 16px;
}

/* Summary */
.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
  padding: 0 16px;
}
.summary-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
}
.summary-val { font-size: 16px; font-weight: 800; color: var(--primary); }
.summary-lbl { font-size: 10px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 3px; }

/* Payment cards */
.payments-list { display: flex; flex-direction: column; gap: 10px; padding: 0 16px; }

.payment-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 14px 16px;
  transition: border-color 0.2s;
}
.payment-card.expiring { border-color: #f59e0b; }
.payment-card.expired  { border-color: #ef4444; opacity: 0.7; }

.payment-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.payment-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.payment-info { flex: 1; min-width: 0; }
.payment-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.payment-category { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.payment-amount { text-align: right; flex-shrink: 0; }
.amount-main { font-size: 18px; font-weight: 800; color: var(--text-primary); }
.amount-monthly { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

/* Progress */
.installment-section { margin-bottom: 10px; }
.installment-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.text-success { color: #10b981; font-weight: 600; }
.text-muted   { color: var(--text-secondary); }

.progress-bar {
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* Dates */
.payment-dates {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.badge-expiring {
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 600;
}
.badge-expired {
  background: rgba(239,68,68,0.12);
  color: #ef4444;
  padding: 2px 8px;
  border-radius: 5px;
  font-weight: 600;
}

.payment-notes {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 6px;
}

/* Actions */
.payment-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.btn-icon-sm {
  width: 32px; height: 32px;
  border-radius: 8px; border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.btn-icon-sm svg { width: 15px; height: 15px; }
.btn-icon-sm:active { transform: scale(0.92); }
.btn-icon-sm.danger { color: var(--danger); }
.btn-icon-sm.danger:active { background: rgba(239,68,68,0.12); }

/* Form modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  backdrop-filter: blur(2px);
}

.modal-sheet {
  background: var(--bg-card);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-height: 90dvh;
  overflow-y: auto;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 1;
}
.modal-header h3 { font-size: 17px; font-weight: 700; }

.modal-close {
  width: 32px; height: 32px;
  border-radius: 50%; border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.modal-close svg { width: 16px; height: 16px; }

.modal-body { padding: 16px 20px; }

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-actions {
  display: flex;
  gap: 10px;
  padding-top: 8px;
}
.form-actions .btn { flex: 1; }

/* Modal transition */
.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal-sheet, .modal-leave-active .modal-sheet { transition: transform 0.3s cubic-bezier(0.32,0.72,0,1); }
.modal-enter-from .modal-sheet, .modal-leave-to .modal-sheet { transform: translateY(100%); }
</style>
