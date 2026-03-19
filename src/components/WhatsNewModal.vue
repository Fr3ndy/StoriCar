<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { changelog, APP_VERSION, isNewVersion, markVersionSeen } from '../lib/changelog'

const router = useRouter()
const visible = ref(false)

const latestRelease = computed(() => changelog[0])

onMounted(() => {
  if (isNewVersion()) {
    // Piccolo delay per non mostrarlo subito al caricamento
    setTimeout(() => { visible.value = true }, 800)
  }
})

function close() {
  markVersionSeen()
  visible.value = false
}

function goToChangelog() {
  close()
  router.push('/changelog')
}

function typeLabel(type) {
  return { new: 'Nuovo', improved: 'Migliorato', fixed: 'Fix', removed: 'Rimosso' }[type] || type
}
</script>

<template>
  <Transition name="modal">
    <div v-if="visible" class="wn-overlay" @click.self="close">
      <div class="wn-modal" role="dialog" aria-modal="true">

        <!-- Header -->
        <div class="wn-header">
          <div class="wn-header-left">
            <div class="wn-icon">{{ latestRelease.emoji }}</div>
            <div>
              <div class="wn-label">Novità in questa versione</div>
              <div class="wn-ver">v{{ latestRelease.version }} — {{ latestRelease.title }}</div>
            </div>
          </div>
          <button class="wn-close" @click="close" aria-label="Chiudi">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Highlights -->
        <div v-if="latestRelease.highlights?.length" class="wn-highlight">
          <p v-for="h in latestRelease.highlights" :key="h">{{ h }}</p>
        </div>

        <!-- Changes list (max 6) -->
        <div class="wn-changes">
          <div
            v-for="change in latestRelease.changes.slice(0, 6)"
            :key="change.text"
            class="wn-change-row"
          >
            <span class="wn-badge" :class="change.type">{{ typeLabel(change.type) }}</span>
            <span class="wn-text">{{ change.text }}</span>
          </div>
          <div v-if="latestRelease.changes.length > 6" class="wn-more">
            +{{ latestRelease.changes.length - 6 }} altri cambiamenti
          </div>
        </div>

        <!-- Footer -->
        <div class="wn-footer">
          <button class="wn-btn-secondary" @click="goToChangelog">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Vedi tutte le versioni
          </button>
          <button class="wn-btn-primary" @click="close">Ottimo!</button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Overlay */
.wn-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(3px);
  padding: 0;
}

@media (min-width: 500px) {
  .wn-overlay { align-items: center; padding: 24px; }
}

/* Modal */
.wn-modal {
  background: var(--bg-card);
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 85dvh;
  overflow-y: auto;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  box-shadow: 0 -8px 40px rgba(0,0,0,0.15);
}

@media (min-width: 500px) {
  .wn-modal {
    border-radius: 20px;
    border: 1px solid var(--border);
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    max-height: 80vh;
  }
}

/* Animations */
.modal-enter-active, .modal-leave-active { transition: opacity .22s ease; }
.modal-enter-active .wn-modal, .modal-leave-active .wn-modal {
  transition: transform .26s cubic-bezier(.32,.72,0,1);
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .wn-modal, .modal-leave-to .wn-modal { transform: translateY(40px); }

@media (min-width: 500px) {
  .modal-enter-from .wn-modal, .modal-leave-to .wn-modal { transform: scale(0.96) translateY(8px); }
}

/* Header */
.wn-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.wn-header-left { display: flex; align-items: center; gap: 12px; }

.wn-icon {
  font-size: 24px; line-height: 1;
  width: 44px; height: 44px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--r);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.wn-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--primary);
  margin-bottom: 2px;
}

.wn-ver {
  font-size: 15px; font-weight: 700;
  color: var(--text-primary);
}

.wn-close {
  width: 30px; height: 30px;
  border-radius: var(--r-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: all 0.15s;
}
.wn-close:active { background: var(--border); }
.wn-close svg { width: 14px; height: 14px; }

/* Highlight */
.wn-highlight {
  margin: 12px 20px;
  padding: 10px 14px;
  background: var(--primary-soft);
  border-radius: var(--r);
  border-left: 3px solid var(--primary);
}
[data-theme="dark"] .wn-highlight { background: var(--primary-glow); }
.wn-highlight p { font-size: 13px; color: var(--primary); font-weight: 500; line-height: 1.5; }
[data-theme="dark"] .wn-highlight p { color: #93c5fd; }

/* Changes */
.wn-changes {
  padding: 4px 0 8px;
}

.wn-change-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 20px;
  border-bottom: 1px solid var(--border);
}
.wn-change-row:last-of-type { border-bottom: none; }

.wn-badge {
  font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 20px;
  white-space: nowrap; flex-shrink: 0;
  text-transform: uppercase; letter-spacing: 0.3px;
  margin-top: 1px;
}
.wn-badge.new      { background: rgba(16,185,129,0.10); color: #047857; }
.wn-badge.improved { background: rgba(37,99,235,0.09);  color: #2563eb; }
.wn-badge.fixed    { background: rgba(245,158,11,0.10); color: #b45309; }
.wn-badge.removed  { background: rgba(239,68,68,0.09);  color: #b91c1c; }
[data-theme="dark"] .wn-badge.new      { background: rgba(16,185,129,0.12); color: #6ee7b7; }
[data-theme="dark"] .wn-badge.improved { background: rgba(68,147,248,0.14); color: #93c5fd; }
[data-theme="dark"] .wn-badge.fixed    { background: rgba(245,158,11,0.12); color: #fcd34d; }
[data-theme="dark"] .wn-badge.removed  { background: rgba(239,68,68,0.12);  color: #fca5a5; }

.wn-text { font-size: 13px; color: var(--text-primary); line-height: 1.5; }

.wn-more {
  padding: 8px 20px;
  font-size: 12px; color: var(--text-secondary); font-style: italic;
}

/* Footer */
.wn-footer {
  display: flex; gap: 10px;
  padding: 14px 20px 4px;
  border-top: 1px solid var(--border);
}

.wn-btn-secondary {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 11px 14px;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.wn-btn-secondary svg { width: 14px; height: 14px; flex-shrink: 0; }
.wn-btn-secondary:active { background: var(--border); }

.wn-btn-primary {
  padding: 11px 22px;
  border-radius: var(--r);
  border: none;
  background: var(--primary);
  color: white;
  font-size: 14px; font-weight: 700;
  cursor: pointer; transition: background 0.15s;
  white-space: nowrap;
}
.wn-btn-primary:active { background: var(--primary-dark); }
</style>
