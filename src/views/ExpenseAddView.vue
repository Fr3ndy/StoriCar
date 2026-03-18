<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const route = useRoute()
const { data, addExpense, updateExpense, getExpense, getDefaultVehicleId } = useStorage()

const isEditing = computed(() => route.name === 'expenses-edit')
const editId = computed(() => route.params.id)

const vehicles = computed(() => data.value.vehicles)

const categories = [
  { value: 'maintenance', label: 'Manutenzione' },
  { value: 'insurance',   label: 'Assicurazione' },
  { value: 'tax',         label: 'Bollo' },
  { value: 'tires',       label: 'Gomme' },
  { value: 'wash',        label: 'Lavaggio' },
  { value: 'parking',     label: 'Parcheggio' },
  { value: 'toll',        label: 'Pedaggi' },
  { value: 'fine',        label: 'Multe' },
  { value: 'other',       label: 'Altro' }
]

const form = ref({
  vehicleId: '',
  date: new Date().toISOString().split('T')[0],
  category: 'maintenance',
  amount: '',
  description: '',
  notes: ''
})

onMounted(() => {
  if (isEditing.value && editId.value) {
    const expense = getExpense(editId.value)
    if (expense) {
      form.value = {
        vehicleId: expense.vehicleId,
        date: expense.date,
        category: expense.category || 'other',
        amount: expense.amount?.toString() || '',
        description: expense.description || '',
        notes: expense.notes || ''
      }
    } else {
      router.push('/expenses')
    }
  } else {
    const defaultId = getDefaultVehicleId()
    if (defaultId) {
      form.value.vehicleId = defaultId
    } else if (vehicles.value.length > 0) {
      form.value.vehicleId = vehicles.value[0].id
    }
  }
})

async function save() {
  const expenseData = {
    vehicleId: form.value.vehicleId,
    date: form.value.date,
    category: form.value.category,
    amount: parseFloat(form.value.amount) || 0,
    description: form.value.description,
    notes: form.value.notes
  }
  if (isEditing.value) {
    await updateExpense(editId.value, expenseData)
  } else {
    await addExpense(expenseData)
  }
  router.push('/expenses')
}

const canSave = computed(() => form.value.vehicleId && form.value.date && form.value.amount)
</script>

<template>
  <div class="view-container">
    <div class="card form-card">

      <div class="form-group">
        <label class="form-label">Veicolo *</label>
        <select v-model="form.vehicleId" class="form-select">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.name }}{{ v.plate ? ` (${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data *</label>
          <input v-model="form.date" type="date" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Importo (€) *</label>
          <input
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0"
            class="form-input"
            placeholder="100.00"
            required
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Categoria *</label>
        <select v-model="form.category" class="form-select">
          <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <input
          v-model="form.description"
          type="text"
          class="form-input"
          placeholder="es. Cambio olio, Revisione…"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea v-model="form.notes" class="form-input" rows="2" placeholder="Note opzionali…"></textarea>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="router.back()">Annulla</button>
        <button class="btn btn-primary" @click="save" :disabled="!canSave">
          {{ isEditing ? 'Salva modifiche' : 'Aggiungi' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 16px;
  padding-bottom: 40px;
}

.form-card {
  padding: 20px 16px;
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

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}
</style>
