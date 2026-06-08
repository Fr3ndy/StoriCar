<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const route  = useRoute()
const { data, selectedVehicleId, addAction, updateAction, getAction } = useStorage()

const isEditing = computed(() => route.name === 'action-edit')
const editId    = computed(() => route.params.id)

const builtinActionTypes = [
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
const actionTypes = computed(() => [
  ...builtinActionTypes,
  ...(data.value.settings?.customActionTypes || [])
])

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
      form.value = {
        type:      action.type || 'altro',
        date:      action.date || '',
        notes:     action.notes || '',
        cost:      action.cost?.toString() || '',
        odometer:  action.odometer?.toString() || ''
      }
    } else {
      router.push('/actions')
    }
  }
})

async function save() {
  const payload = {
    vehicleId: selectedVehicleId.value,
    type:      form.value.type,
    date:      form.value.date,
    notes:     form.value.notes || null,
    cost:      form.value.cost ? parseFloat(form.value.cost) : null,
    odometer:  form.value.odometer ? parseFloat(form.value.odometer) : null,
  }
  if (isEditing.value) {
    await updateAction(editId.value, payload)
  } else {
    await addAction(payload)
  }
  router.push('/actions')
}

const canSave = computed(() => form.value.type && form.value.date)
</script>

<template>
  <div class="view-container">
    <div class="card form-card">
      <h3 class="form-title">{{ isEditing ? 'Modifica azione' : 'Nuova azione' }}</h3>

      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <select v-model="form.type" class="form-select">
          <option v-for="t in actionTypes" :key="t.value" :value="t.value">
            {{ t.icon }} {{ t.label }}
          </option>
        </select>
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
.form-actions {
  display: flex; gap: 10px; justify-content: flex-end;
  margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);
}
</style>
