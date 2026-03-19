<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const route  = useRoute()
const router = useRouter()

const loading  = ref(true)
const profile  = ref(null)
const notFound = ref(false)

const username = route.params.username

onMounted(async () => {
  try {
    const { data, error } = await supabase.rpc('get_public_profile', { p_username: username })
    if (error || !data) {
      notFound.value = true
    } else {
      profile.value = data
    }
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})

function formatDate(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const copied = ref(false)
</script>

<template>
  <div>

    <!-- Loading -->
    <div v-if="loading" class="pp-loading">
      <div class="loading-spinner"></div>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
      <h2>Profilo non trovato</h2>
      <p>@{{ username }} non esiste o ha il profilo privato.</p>
      <button class="btn btn-secondary" style="margin-top:16px" @click="router.push('/')">Torna all'app</button>
    </div>

    <!-- Profile -->
    <div v-else-if="profile" class="dashboard">

      <!-- Header card -->
      <div class="vehicle-card pp-header-card">
        <div class="vc-top">
          <div class="pp-avatar-wrap">
            <img
              v-if="profile.avatar_url"
              :src="profile.avatar_url"
              class="pp-avatar"
              alt="Avatar"
              referrerpolicy="no-referrer"
            />
            <div v-else class="vc-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          </div>
          <div class="vc-info">
            <div class="vc-name">{{ profile.username }}</div>
            <div v-if="profile.member_since" class="vc-sub">Su Storicar dal {{ formatDate(profile.member_since) }}</div>
          </div>
          <button class="btn-share" @click="copyLink">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
            {{ copied ? 'Copiato!' : '' }}
          </button>
        </div>
      </div>

      <!-- Experimental banner -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Profilo pubblico</span>
          <span class="badge-experimental">Sperimentale</span>
        </div>
        <div class="card">
          <div class="exp-row">
            <div class="exp-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <p class="exp-text">Questa sezione è ancora in fase di sviluppo. Presto potrai visualizzare statistiche e attività del profilo pubblico.</p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="section">
        <div class="card" style="text-align:center">
          <p style="font-size:14px;color:var(--text-secondary);margin:0 0 12px">Traccia anche le spese della tua auto con Storicar</p>
          <button class="btn btn-primary" @click="router.push('/login')">Inizia gratis</button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Loading */
.pp-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Empty state — reuses global .empty-state if defined, else: */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  min-height: 60vh;
  color: var(--text-secondary);
}
.empty-state svg { width: 64px; height: 64px; opacity: 0.4; }
.empty-state h2  { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.empty-state p   { font-size: 14px; margin: 0; }

/* Dashboard layout — same as HomeView */
.dashboard { display: flex; flex-direction: column; }

/* Header card */
.pp-header-card { margin-bottom: 10px; }

.vc-top { display: flex; align-items: center; gap: 12px; }

.vc-icon {
  width: 42px; height: 42px;
  border-radius: var(--r);
  background: var(--primary-soft); color: var(--primary);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
[data-theme="dark"] .vc-icon { background: var(--primary-glow); color: #93c5fd; }
.vc-icon svg { width: 22px; height: 22px; }

.pp-avatar-wrap { flex-shrink: 0; }
.pp-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  display: block;
}

.vc-info { flex: 1; min-width: 0; }
.vc-name { font-size: 16px; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.vc-sub  { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* Share button */
.btn-share {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.btn-share svg { width: 15px; height: 15px; }
.btn-share:active { opacity: 0.7; }

/* Sections */
.section { margin-bottom: 10px; }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; padding: 0 2px;
}
.section-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }

.badge-experimental {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--primary);
  background: var(--primary-glow);
  border-radius: 6px;
  padding: 2px 8px;
}

/* Card — reuses global .card */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

/* Experimental row */
.exp-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.exp-icon {
  flex-shrink: 0;
  width: 36px; height: 36px;
  border-radius: var(--r);
  background: var(--primary-soft);
  display: flex; align-items: center; justify-content: center;
}
[data-theme="dark"] .exp-icon { background: var(--primary-glow); }
.exp-icon svg { width: 18px; height: 18px; color: var(--primary); }

.exp-text {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
  padding-top: 2px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 20px;
  border-radius: var(--r-md);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--primary);
  color: white;
  box-shadow: 0 3px 12px rgba(37,99,235,0.28);
}
.btn-primary:active { opacity: 0.85; }
.btn-secondary {
  background: none;
  color: var(--text-primary);
  border: 1.5px solid var(--border);
}
.btn-secondary:active { opacity: 0.7; }
</style>
