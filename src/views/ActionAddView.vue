<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const route  = useRoute()
const { data, selectedVehicleId, addAction, updateAction, getAction, setSetting } = useStorage()

const isEditing = computed(() => route.name === 'action-edit')
const editId    = computed(() => route.params.id)

// ── Tipi azione: lista completamente gestibile ────────────────
const DEFAULT_TYPES = [
  { value: 'acqua_radiatore',  label: 'Acqua radiatore',    icon: '💧' },
  { value: 'olio_motore',      label: 'Olio motore',        icon: '🛢️' },
  { value: 'pressione_gomme',  label: 'Pressione gomme',    icon: '🔧' },
  { value: 'lavaggio',         label: 'Lavaggio',           icon: '🚿' },
  { value: 'filtro_aria',      label: 'Filtro aria',        icon: '💨' },
  { value: 'luci',             label: 'Controllo luci',     icon: '💡' },
  { value: 'batteria',         label: 'Controllo batteria', icon: '🔋' },
  { value: 'freni',            label: 'Controllo freni',    icon: '🛑' },
  { value: 'liquido_freni',    label: 'Liquido freni',      icon: '🧪' },
  { value: 'antigelo',         label: 'Antigelo',           icon: '❄️' },
  { value: 'altro',            label: 'Altro',              icon: '📋' },
]

const actionTypes = computed(() =>
  (data.value.settings?.allActionTypes?.length > 0)
    ? data.value.settings.allActionTypes
    : DEFAULT_TYPES
)

// ── Gestione tipi ─────────────────────────────────────────────
const showManage    = ref(false)
const editingLabels = ref({})
const newTypeLabel  = ref('')
const newTypeIcon   = ref('📋')

function openManage() {
  if (!data.value.settings?.allActionTypes?.length) {
    setSetting('allActionTypes', DEFAULT_TYPES.map(t => ({ ...t })))
  }
  editingLabels.value = {}
  actionTypes.value.forEach(t => { editingLabels.value[t.value] = t.label })
  showManage.value = true
}

async function saveLabel(type) {
  const newLabel = (editingLabels.value[type.value] || '').trim()
  if (!newLabel || newLabel === type.label) return
  const updated = actionTypes.value.map(t => t.value === type.value ? { ...t, label: newLabel } : t)
  await setSetting('allActionTypes', updated)
}

async function deleteType(type) {
  if (actionTypes.value.length <= 1) return
  const updated = actionTypes.value.filter(t => t.value !== type.value)
  await setSetting('allActionTypes', updated)
  if (form.value.type === type.value) form.value.type = updated[0]?.value || ''
}

async function addType() {
  const label = newTypeLabel.value.trim()
  if (!label) return
  const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString(36)
  const updated = [...actionTypes.value, { value, label, icon: newTypeIcon.value || '📋' }]
  await setSetting('allActionTypes', updated)
  editingLabels.value[value] = label
  form.value.type = value
  newTypeLabel.value = ''
  newTypeIcon.value = '📋'
}

async function resetTypes() {
  if (!confirm('Ripristinare i tipi predefiniti? Le modifiche andranno perse.')) return
  await setSetting('allActionTypes', DEFAULT_TYPES.map(t => ({ ...t })))
  editingLabels.value = {}
  DEFAULT_TYPES.forEach(t => { editingLabels.value[t.value] = t.label })
}

// ── Form ──────────────────────────────────────────────────────
const form = ref({
  type: 'acqua_radiatore',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  cost: '',
  odometer: ''
})

onMounted(() => {
  if (isEditing.value && editId.value) {
    const action = getAction(editId.value)
    if (action) {
      form.value = { type: action.type || 'altro', date: action.date || '', notes: action.notes || '', cost: action.cost?.toString() || '', odometer: action.odometer?.toString() || '' }
    } else {
      router.push('/actions')
    }
  }
})

async function save() {
  const payload = { vehicleId: selectedVehicleId.value, type: form.value.type, date: form.value.date, notes: form.value.notes || null, cost: form.value.cost ? parseFloat(form.value.cost) : null, odometer: form.value.odometer ? parseFloat(form.value.odometer) : null }
  if (isEditing.value) { await updateAction(editId.value, payload) }
  else { await addAction(payload) }
  router.push('/actions')
}

const canSave = computed(() => form.value.type && form.value.date)
</script>

<template>
  <div class="view-container">
    <div class="card form-card">
      <h3 class="form-title">{{ isEditing ? 'Modifica azione' : 'Nuova azione' }}</h3>

      <!-- Tipo + gestione -->
      <div class="form-group">
        <div class="cat-header">
          <label class="form-label" style="margin:0">Tipo *</label>
          <button class="manage-link" @click="showManage ? showManage = false : openManage()">
            {{ showManage ? 'Chiudi' : '⚙ Gestisci' }}
          </button>
        </div>
        <select v-if="!showManage" v-model="form.type" class="form-select">
          <option v-for="t in actionTypes" :key="t.value" :value="t.value">{{ t.icon }} {{ t.label }}</option>
        </select>

        <!-- Manage panel -->
        <div v-else class="manage-panel">
          <div v-for="type in actionTypes" :key="type.value" class="manage-row">
            <span class="type-icon">{{ type.icon }}</span>
            <input
              v-model="editingLabels[type.value]"
              type="text"
              class="form-input manage-input"
              @blur="saveLabel(type)"
              @keyup.enter="saveLabel(type)"
            />
            <button class="manage-del" @click="deleteType(type)" :disabled="actionTypes.length <= 1" title="Elimina">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div class="manage-add-row">
            <input v-model="newTypeIcon" type="text" class="form-input icon-input" placeholder="🔧" maxlength="2" />
            <input v-model="newTypeLabel" type="text" class="form-input manage-input" placeholder="Nuovo tipo…" @keyup.enter="addType" />
            <button class="btn btn-sm btn-primary" :disabled="!newTypeLabel.trim()" @click="addType">+</button>
          </div>
          <button class="reset-link" @click="resetTypes">↺ Ripristina predefiniti</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Data *</label>
        <input v-model="form.date" type="date" class="form-input" required />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Km (odometro)</label>
          <input v-model="form.odometer" type="number" class="form-input" placeholder="es. 52000" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Costo (€)</label>
          <input v-model="form.cost" type="number" class="form-input" placeholder="es. 15,00" min="0" step="0.01" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea v-model="form.notes" class="form-textarea" placeholder="Marca prodotto, dettagli, ecc." rows="3"></textarea>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="router.back()">Annulla</button>
        <button class="btn btn-primary" @click="save" :disabled="!canSave">
          {{ isEditing ? 'Salva' : 'Aggiungi' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { padding: 0 0 40px; }
.form-card      { padding: 20px 16px; }
.form-title     { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 18px; }
.form-row       { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-actions   { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }

.cat-header  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.manage-link { background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; }

.manage-panel { border: 1px solid var(--border); border-radius: var(--r); padding: 10px 12px; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 6px; }
.manage-row   { display: flex; gap: 6px; align-items: center; }
.type-icon    { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
.manage-input { flex: 1; font-size: 13px; padding: 6px 10px; }
.icon-input   { width: 44px; flex-shrink: 0; text-align: center; font-size: 16px; padding: 6px 4px; }
.manage-del   { width: 30px; height: 30px; border-radius: var(--r-sm); background: none; border: 1px solid var(--border); color: var(--danger); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.manage-del:disabled { opacity: .3; cursor: not-allowed; }
.manage-del svg { width: 13px; height: 13px; }
.manage-add-row { display: flex; gap: 6px; align-items: center; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--border); }
.reset-link { background: none; border: none; font-size: 11px; color: var(--text-tertiary); cursor: pointer; text-align: left; padding: 2px 0; text-decoration: underline; }
</style>
