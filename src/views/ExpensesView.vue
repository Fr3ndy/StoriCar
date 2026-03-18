<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const { data, dataReady, getDefaultVehicleId, setDefaultVehicle, deleteExpense } = useStorage()

const selectedVehicleId = ref(null)

const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)

const expenses = computed(() => {
  if (!selectedVehicleId.value) return []
  return data.value.expenses
    .filter(e => e.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const categories = {
  maintenance: { label: 'Manutenzione', color: '#f59e0b' },
  insurance:   { label: 'Assicurazione', color: '#6366f1' },
  tax:         { label: 'Bollo',         color: '#ef4444' },
  tires:       { label: 'Gomme',         color: '#f97316' },
  wash:        { label: 'Lavaggio',      color: '#06b6d4' },
  parking:     { label: 'Parcheggio',    color: '#8b5cf6' },
  toll:        { label: 'Pedaggi',       color: '#64748b' },
  fine:        { label: 'Multe',         color: '#ef4444' },
  other:       { label: 'Altro',         color: '#64748b' }
}

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

function formatNumber(num, decimals = 2) {
  if (num == null) return '-'
  return num.toFixed(decimals).replace('.', ',')
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function confirmDelete(expense) {
  if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
    await deleteExpense(expense.id)
  }
}

function editExpense(expense) {
  router.push(`/expenses/edit/${expense.id}`)
}

function getCategoryInfo(category) {
  return categories[category] || categories.other
}
</script>

<template>
  <div class="view-container">

    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo per registrare le spese</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">Aggiungi Veicolo</button>
    </div>

    <template v-else>
      <!-- Vehicle selector -->
      <div style="margin-bottom:16px">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Empty -->
      <div v-if="expenses.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2>Nessuna spesa</h2>
        <p>Registra la tua prima spesa extra</p>
      </div>

      <!-- Expense list -->
      <div v-else class="expense-list">
        <div v-for="expense in expenses" :key="expense.id" class="card expense-card">
          <div class="expense-top">
            <!-- Category + date -->
            <div class="expense-meta">
              <span
                class="cat-pill"
                :style="{ background: getCategoryInfo(expense.category).color + '1a', color: getCategoryInfo(expense.category).color }"
              >
                {{ getCategoryInfo(expense.category).label }}
              </span>
              <span class="expense-date">{{ formatDate(expense.date) }}</span>
            </div>
            <!-- Amount -->
            <div class="expense-amount">{{ formatNumber(expense.amount) }} €</div>
          </div>

          <div v-if="expense.description" class="expense-desc">{{ expense.description }}</div>
          <div v-if="expense.notes" class="expense-notes">{{ expense.notes }}</div>

          <div class="expense-actions">
            <button class="action-btn" @click="editExpense(expense)" title="Modifica">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="action-btn danger" @click="confirmDelete(expense)" title="Elimina">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <button class="fab" @click="router.push('/expenses/add')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.view-container {
  padding: 16px;
  padding-bottom: 100px;
}

.expense-list { display: flex; flex-direction: column; }

.expense-card {
  padding: 14px 16px;
  margin-bottom: 10px;
}

.expense-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.expense-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cat-pill {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  width: fit-content;
}

.expense-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.expense-amount {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  flex-shrink: 0;
}

.expense-desc {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 10px;
}

.expense-notes {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 4px;
}

.expense-actions {
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
