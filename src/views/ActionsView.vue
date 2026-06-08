<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'

const router = useRouter()
const { data, selectedVehicleId, deleteAction } = useStorage()

const vehicles    = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)

const actions = computed(() => {
  if (!selectedVehicleId.value) return []
  return (data.value.actions || [])
    .filter(a => a.vehicleId === selectedVehicleId.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const actionTypes = {
  acqua_radiatore: { label: 'Acqua radiatore',    icon: '💧' },
  olio_motore:     { label: 'Olio motore',        icon: '🛢️' },
  pressione_gomme: { label: 'Pressione gomme',    icon: '🔧' },
  lavaggio:        { label: 'Lavaggio',           icon: '🚿' },
  filtro_aria:     { label: 'Filtro aria',        icon: '💨' },
  luci:            { label: 'Controllo luci',     icon: '💡' },
  batteria:        { label: 'Controllo batteria', icon: '🔋' },
  freni:           { label: 'Controllo freni',    icon: '🛑' },
  liquido_freni:   { label: 'Liquido freni',      icon: '🧪' },
  antigelo:        { label: 'Antigelo',           icon: '❄️' },
  altro:           { label: 'Altro',              icon: '📋' },
}

function getActionType(value) {
  const managed = data.value.settings?.allActionTypes || []
  if (managed.length) {
    const m = managed.find(t => t.value === value)
    if (m) return { label: m.label, icon: m.icon || '📋' }
  }
  return actionTypes[value] || { label: value, icon: '📋' }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function confirmDelete(action) {
  if (confirm(`Eliminare "${getActionType(action.type).label}"?`)) {
    await deleteAction(action.id)
  }
}
</script>

<template>
  <div class="view-container">

    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
    </div>

    <template v-else>
      <div v-if="actions.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <h2>Nessuna azione</h2>
        <p>Tieni traccia di manutenzioni e controlli</p>
      </div>

      <div v-else class="actions-list">
        <div v-for="action in actions" :key="action.id" class="card action-card">
          <div class="ac-top">
            <span class="ac-icon">{{ getActionType(action.type).icon }}</span>
            <div class="ac-info">
              <div class="ac-label">{{ getActionType(action.type).label }}</div>
              <div class="ac-date">{{ formatDate(action.date) }}
                <span v-if="action.odometer"> · {{ action.odometer.toLocaleString('it-IT') }} km</span>
              </div>
              <div v-if="action.notes" class="ac-notes">{{ action.notes }}</div>
            </div>
            <div class="ac-right">
              <div v-if="action.cost != null" class="ac-cost">€ {{ action.cost.toFixed(2).replace('.', ',') }}</div>
              <div class="ac-btns">
                <button class="ac-btn" @click="router.push(`/actions/edit/${action.id}`)" title="Modifica">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button class="ac-btn danger" @click="confirmDelete(action)" title="Elimina">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="fab" @click="router.push('/actions/add')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.view-container  { padding: 0 0 100px; }
.actions-list    { display: flex; flex-direction: column; gap: 8px; }
.action-card     { padding: 14px 16px; }

.ac-top { display: flex; align-items: flex-start; gap: 12px; }
.ac-icon { font-size: 24px; line-height: 1; flex-shrink: 0; padding-top: 2px; }

.ac-info  { flex: 1; min-width: 0; }
.ac-label { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.ac-date  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.ac-notes { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; white-space: pre-line; }

.ac-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.ac-cost  { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.ac-btns  { display: flex; gap: 4px; }

.ac-btn {
  width: 30px; height: 30px; border-radius: var(--r-sm);
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .15s;
}
.ac-btn:active { opacity: .7; }
.ac-btn svg    { width: 14px; height: 14px; }
.ac-btn.danger { color: var(--danger); }
.ac-btn.danger:active { background: rgba(239,68,68,.08); }
</style>
