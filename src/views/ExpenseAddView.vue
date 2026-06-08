<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const route  = useRoute()
const { data, addExpense, updateExpense, getExpense, selectedVehicleId, setSetting } = useStorage()

const isEditing = computed(() => route.name === 'expenses-edit')
const editId    = computed(() => route.params.id)
const vehicles  = computed(() => data.value.vehicles)

// ── Categorie: lista completamente gestibile ──────────────────
const DEFAULT_CATEGORIES = [
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

// Usa allExpenseCategories se impostato, altrimenti default
const categories = computed(() =>
  (data.value.settings?.allExpenseCategories?.length > 0)
    ? data.value.settings.allExpenseCategories
    : DEFAULT_CATEGORIES
)

// ── Gestione categorie ────────────────────────────────────────
const showManage  = ref(false)
const editingLabels = ref({})
const newCatLabel   = ref('')
const newCatIcon    = ref('📋')

function openManage() {
  // Inizializza da default se non ancora personalizzato
  if (!data.value.settings?.allExpenseCategories?.length) {
    setSetting('allExpenseCategories', DEFAULT_CATEGORIES.map(c => ({ ...c })))
  }
  // Copia le label per editing
  editingLabels.value = {}
  categories.value.forEach(c => { editingLabels.value[c.value] = c.label })
  showManage.value = true
}

async function saveLabel(cat) {
  const newLabel = (editingLabels.value[cat.value] || '').trim()
  if (!newLabel || newLabel === cat.label) return
  const updated = categories.value.map(c => c.value === cat.value ? { ...c, label: newLabel } : c)
  await setSetting('allExpenseCategories', updated)
}

async function deleteCategory(cat) {
  if (categories.value.length <= 1) return
  const updated = categories.value.filter(c => c.value !== cat.value)
  await setSetting('allExpenseCategories', updated)
  if (form.value.category === cat.value) form.value.category = updated[0]?.value || ''
}

async function addCategory() {
  const label = newCatLabel.value.trim()
  if (!label) return
  const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString(36)
  const updated = [...categories.value, { value, label, icon: newCatIcon.value || '📋' }]
  await setSetting('allExpenseCategories', updated)
  editingLabels.value[value] = label
  form.value.category = value
  newCatLabel.value = ''
  newCatIcon.value = '📋'
}

async function resetCategories() {
  if (!confirm('Ripristinare le categorie predefinite? Le modifiche andranno perse.')) return
  await setSetting('allExpenseCategories', DEFAULT_CATEGORIES.map(c => ({ ...c })))
  editingLabels.value = {}
  DEFAULT_CATEGORIES.forEach(c => { editingLabels.value[c.value] = c.label })
}

// ── Form ──────────────────────────────────────────────────────
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
      form.value = { vehicleId: expense.vehicleId, date: expense.date, category: expense.category || 'other', amount: expense.amount?.toString() || '', description: expense.description || '', notes: expense.notes || '' }
    } else {
      router.push('/expenses')
    }
  } else {
    form.value.vehicleId = selectedVehicleId.value || vehicles.value[0]?.id || ''
  }
})

async function save() {
  await (isEditing.value ? updateExpense(editId.value, {
    vehicleId: form.value.vehicleId, date: form.value.date, category: form.value.category,
    amount: parseFloat(form.value.amount) || 0, description: form.value.description, notes: form.value.notes
  }) : addExpense({
    vehicleId: form.value.vehicleId, date: form.value.date, category: form.value.category,
    amount: parseFloat(form.value.amount) || 0, description: form.value.description, notes: form.value.notes
  }))
  router.push('/expenses')
}

const canSave = computed(() => form.value.vehicleId && form.value.date && form.value.amount)
</script>

<template>
  <div class="view-container">
    <div class="card form-card">

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data *</label>
          <input v-model="form.date" type="date" class="form-input" required />
        </div>
        <div class="form-group">
          <label class="form-label">Importo (€) *</label>
          <input v-model="form.amount" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" required />
        </div>
      </div>

      <!-- Categoria + gestione -->
      <div class="form-group">
        <div class="cat-header">
          <label class="form-label" style="margin:0">Categoria *</label>
          <button class="manage-link" @click="showManage ? showManage = false : openManage()">
            {{ showManage ? 'Chiudi' : '⚙ Gestisci' }}
          </button>
        </div>

        <!-- Chip grid con icone -->
        <div v-if="!showManage" class="type-grid">
          <button
            v-for="cat in categories"
            :key="cat.value"
            type="button"
            class="type-chip"
            :class="{ active: form.category === cat.value }"
            @click="form.category = cat.value"
          >
            <span>{{ cat.icon || '📋' }}</span> {{ cat.label }}
          </button>
        </div>

        <!-- Manage panel -->
        <div v-else class="manage-panel">
          <div v-for="cat in categories" :key="cat.value" class="manage-row">
            <span class="type-icon">{{ cat.icon || '📋' }}</span>
            <input
              v-model="editingLabels[cat.value]"
              type="text"
              class="form-input manage-input"
              @blur="saveLabel(cat)"
              @keyup.enter="saveLabel(cat)"
            />
            <button class="manage-del" @click="deleteCategory(cat)" :disabled="categories.length <= 1" title="Elimina">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div class="manage-add-row">
            <input v-model="newCatIcon" type="text" class="form-input icon-input" placeholder="📋" maxlength="2" />
            <input v-model="newCatLabel" type="text" class="form-input manage-input" placeholder="Nuova categoria…" @keyup.enter="addCategory" />
            <button class="btn btn-sm btn-primary" :disabled="!newCatLabel.trim()" @click="addCategory">+</button>
          </div>
          <button class="reset-link" @click="resetCategories">↺ Ripristina predefinite</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <input v-model="form.description" type="text" class="form-input" placeholder="es. Cambio olio, Revisione…" />
      </div>

      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea v-model="form.notes" class="form-textarea" rows="2" placeholder="Note opzionali…"></textarea>
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
.view-container { padding: 0 0 40px; }
.form-card      { padding: 20px 16px; }
.form-row       { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-actions   { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }

.cat-header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.manage-link { background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; }

/* Chip grid */
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
  col