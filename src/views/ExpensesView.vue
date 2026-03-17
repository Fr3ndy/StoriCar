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
  maintenance: { label: 'Manutenzione', class: 'badge-maintenance' },
  insurance: { label: 'Assicurazione', class: 'badge-insurance' },
  tax: { label: 'Bollo', class: 'badge-tax' },
  tires: { label: 'Gomme', class: 'badge-maintenance' },
  wash: { label: 'Lavaggio', class: 'badge-fuel' },
  parking: { label: 'Parcheggio', class: 'badge-other' },
  toll: { label: 'Pedaggi', class: 'badge-other' },
  fine: { label: 'Multe', class: 'badge-tax' },
  other: { label: 'Altro', class: 'badge-other' }
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
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
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
  <div class="expenses-view">
    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary mt-16" @click="router.push('/vehicles')">
        Aggiungi Veicolo
      </button>
    </div>

    <div v-else>
      <!-- Vehicle selector -->
      <div class="vehicle-selector">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.name }} {{ v.plate ? `(${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Expenses list -->
      <div v-if="expenses.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2>Nessuna spesa</h2>
        <p>Registra la tua prima spesa</p>
      </div>

      <div v-else>
        <div
          v-for="expense in expenses"
          :key="expense.id"
          class="card expense-card"
        >
          <div class="expense-header">
            <div>
              <span class="badge" :class="getCategoryInfo(expense.category).class">
                {{ getCategoryInfo(expense.category).label }}
              </span>
              <div class="expense-date">{{ formatDate(expense.date) }}</div>
            </div>
            <div class="expense-amount">{{ formatNumber(expense.amount) }} €</div>
          </div>

          <div v-if="expense.description" class="expense-description">
            {{ expense.description }}
          </div>

          <div v-if="expense.notes" class="expense-notes">
            {{ expense.notes }}
          </div>

          <div class="expense-actions">
            <button class="btn btn-sm btn-secondary" @click="editExpense(expense)">Modifica</button>
            <button class="btn btn-sm btn-danger" @click="confirmDelete(expense)">Elimina</button>
          </div>
        </div>
      </div>

      <button class="fab" @click="router.push('/expenses/add')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.expense-card {
  margin-bottom: 12px;
}

.expense-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.expense-date {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
}

.expense-amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
}

.expense-description {
  font-weight: 500;
  margin-top: 12px;
}

.expense-notes {
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 8px;
}

.expense-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
