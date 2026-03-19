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

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })
}

function formatCurrency(n) {
  if (n == null) return '€0'
  return '€' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
  <div class="public-profile-view">

    <!-- Loading -->
    <div v-if="loading" class="pp-loading">
      <div class="loading-spinner"></div>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="pp-notfound">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
      <h2>Profilo non trovato</h2>
      <p>@{{ username }} non esiste o ha il profilo privato.</p>
      <button class="btn-back" @click="router.push('/')">Torna all'app</button>
    </div>

    <!-- Profile -->
    <div v-else-if="profile" class="pp-content">

      <!-- Header -->
      <div class="pp-header">
        <div class="pp-avatar-wrap">
          <img
            v-if="profile.avatar_url"
            :src="profile.avatar_url"
            class="pp-avatar"
            alt="Avatar"
            referrerpolicy="no-referrer"
          />
          <div v-else class="pp-avatar-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
        </div>

        <h1 class="pp-username">{{ profile.username }}</h1>
        <p v-if="profile.member_since" class="pp-since">Su Storicar dal {{ formatDate(profile.member_since) }}</p>

        <button class="btn-share" @click="copyLink">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
          </svg>
          {{ copied ? 'Link copiato!' : 'Condividi profilo' }}
        </button>
      </div>

      <!-- Stats -->
      <div class="pp-stats-grid">
        <div class="pp-stat">
          <div class="pp-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
            </svg>
          </div>
          <div class="pp-stat-val">{{ formatNum(profile.total_vehicles) }}</div>
          <div class="pp-stat-lbl">Veicoli</div>
        </div>

        <div class="pp-stat">
          <div class="pp-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="pp-stat-val">{{ formatNum(profile.total_fuel_records) }}</div>
          <div class="pp-stat-lbl">Rifornimenti</div>
        </div>

        <div class="pp-stat">
          <div class="pp-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div class="pp-stat-val">{{ formatNum(profile.total_km) }} km</div>
          <div class="pp-stat-lbl">Km percorsi</div>
        </div>

        <div class="pp-stat">
          <div class="pp-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="pp-stat-val">{{ formatCurrency(Number(profile.total_fuel_spent) + Number(profile.total_expenses)) }}</div>
          <div class="pp-stat-lbl">Spese totali</div>
        </div>
      </div>

      <!-- CTA se non loggato -->
      <div class="pp-cta">
        <p>Traccia anche le spese della tua auto con Storicar</p>
        <button class="btn-cta" @click="router.push('/login')">
          Inizia gratis
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.public-profile-view {
  padding: 24px 16px;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
}

/* Loading */
.pp-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Not found */
.pp-notfound {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  color: var(--text-secondary);
}
.pp-notfound svg { width: 64px; height: 64px; opacity: 0.4; }
.pp-notfound h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.pp-notfound p  { font-size: 14px; margin: 0; }

.btn-back {
  margin-top: 8px;
  padding: 10px 20px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--border);
  background: none;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* Content */
.pp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 420px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.pp-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: var(--primary);
  border-radius: 20px;
  padding: 28px 20px 24px;
  text-align: center;
}

.pp-avatar-wrap { position: relative; }

.pp-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255,255,255,0.4);
  display: block;
}
.pp-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pp-avatar-placeholder svg { width: 44px; height: 44px; color: rgba(255,255,255,0.8); }

.pp-username {
  font-size: 24px;
  font-weight: 800;
  color: white;
  margin: 0;
}
.pp-since {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin: 0;
}

.btn-share {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1.5px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.15);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.15s;
}
.btn-share svg { width: 16px; height: 16px; }
.btn-share:hover { background: rgba(255,255,255,0.25); }

/* Stats */
.pp-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.pp-stat {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.pp-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pp-stat-icon svg { width: 20px; height: 20px; color: var(--primary); }

.pp-stat-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}
.pp-stat-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

/* CTA */
.pp-cta {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pp-cta p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}
.btn-cta {
  padding: 13px 20px;
  border-radius: 12px;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(37,99,235,0.3);
}
.btn-cta:hover { background: #1d4ed8; }

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
