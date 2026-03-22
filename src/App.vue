<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from './composables/useStorage'
import { useAuth } from './composables/useAuth'
import { useNotifications } from './composables/useNotifications'
import WhatsNewModal from './components/WhatsNewModal.vue'

const router = useRouter()
const route  = useRoute()
const { getTheme, setTheme, data, dataReady } = useStorage()
const { user, signOut } = useAuth()
const { checkDeadlines } = useNotifications()

const currentTheme = computed(() => data.value.settings.theme)
const menuOpen = ref(false)

// Offline detection
const isOffline = ref(!navigator.onLine)
window.addEventListener('online',  () => { isOffline.value = false })
window.addEventListener('offline', () => { isOffline.value = true  })

function toggleTheme() {
  setTheme(currentTheme.value === 'light' ? 'dark' : 'light')
}

function openMenu()  { menuOpen.value = true  }
function closeMenu() { menuOpen.value = false }

function navigateTo(path) {
  router.push(path)
  closeMenu()
}

async function handleSignOut() {
  closeMenu()
  await signOut()
  router.push('/login')
}

const pageTitle = computed(() => ({
  home: 'Storicar', vehicles: 'Veicoli', fuel: 'Rifornimenti',
  'fuel-add': 'Nuovo Rifornimento', 'fuel-edit': 'Modifica Rifornimento',
  expenses: 'Spese', 'expenses-add': 'Nuova Spesa', 'expenses-edit': 'Modifica Spesa',
  deadlines: 'Scadenze', stats: 'Statistiche', map: 'Mappa',
  'fuel-prices': 'Prezzi', settings: 'Impostazioni', changelog: 'Novità'
}[route.name] || 'Storicar'))

const moreRoutes  = ['vehicles', 'stats', 'map', 'settings', 'expenses', 'expenses-add', 'expenses-edit', 'deadlines', 'changelog']
const isMoreActive = computed(() => moreRoutes.includes(route.name))

// Hide shell on login + public profile pages
const isShell = computed(() => route.name !== 'login' && route.name !== 'public-profile')

watch(dataReady, (val) => { console.log('[App] dataReady:', val) })

onMounted(() => {
  setTheme(getTheme())

  // Forza il reload quando un nuovo service worker prende il controllo (aggiornamento app)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }

  watch(dataReady, (ready) => {
    if (!ready) return
    const days = data.value.settings.notifyDeadlinesDays ?? 30
    checkDeadlines(data.value.deadlines || [], days, data.value.vehicles || [])
  }, { immediate: true })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && dataReady.value) {
      const days = data.value.settings.notifyDeadlinesDays ?? 30
      checkDeadlines(data.value.deadlines || [], days, data.value.vehicles || [])
    }
  })
})
</script>

<template>
  <div class="app">

    <!-- ── Header ── -->
    <header v-if="isShell" class="header">
      <div class="header-left">
        <div class="header-dot"></div>
        <h1>{{ pageTitle }}</h1>
      </div>
      <button class="theme-toggle" @click="toggleTheme" :title="currentTheme === 'light' ? 'Tema scuro' : 'Tema chiaro'">
        <svg v-if="currentTheme === 'light'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      </button>
    </header>

    <!-- ── Offline banner ── -->
    <Transition name="banner">
      <div v-if="isOffline" class="offline-banner">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18"/>
        </svg>
        <span>Sei offline — i dati potrebbero non essere aggiornati</span>
      </div>
    </Transition>

    <!-- ── Beta banner ── -->
    <div v-if="isShell" class="beta-banner">
      <span class="beta-pill">Beta</span>
      <span>I dati potrebbero subire variazioni senza preavviso.</span>
    </div>

    <!-- ── Main content ── -->
    <main class="main-content">
      <div v-if="isShell && !dataReady" class="flex items-center justify-center min-h-40">
        <div class="spinner"></div>
      </div>
      <router-view v-else />
    </main>

    <!-- ── Bottom nav ── -->
    <nav v-if="isShell" class="bottom-nav">
      <router-link to="/" class="nav-item" :class="{ active: route.name === 'home' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        <span>Home</span>
      </router-link>

      <router-link to="/fuel" class="nav-item" :class="{ active: route.name?.startsWith('fuel') && route.name !== 'fuel-prices' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span>Carburante</span>
      </router-link>

      <router-link to="/stats" class="nav-item" :class="{ active: route.name === 'stats' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <span>Statistiche</span>
      </router-link>

      <router-link to="/fuel-prices" class="nav-item" :class="{ active: route.name === 'fuel-prices' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Prezzi</span>
      </router-link>

      <button class="nav-item" :class="{ active: isMoreActive }" @click="openMenu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
        <span>Altro</span>
      </button>
    </nav>

    <!-- ── WhatsNew modal ── -->
    <WhatsNewModal v-if="isShell && dataReady" />

    <!-- ── Drawer overlay ── -->
    <Transition name="overlay">
      <div v-if="menuOpen" class="drawer-overlay" @click="closeMenu"/>
    </Transition>

    <!-- ── Drawer panel ── -->
    <Transition name="drawer">
      <div v-if="menuOpen" class="drawer">

        <div class="drawer-handle"></div>

        <div class="drawer-header">
          <span class="drawer-title">Menu</span>
          <button class="btn-icon" @click="closeMenu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="drawer-body">

          <button class="drawer-item" :class="{ active: route.name?.startsWith('expenses') }" @click="navigateTo('/expenses')">
            <span class="drawer-icon" style="background:rgba(16,185,129,0.10);color:#10b981">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </span>
            <span class="drawer-item-label">Spese</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'deadlines' }" @click="navigateTo('/deadlines')">
            <span class="drawer-icon" style="background:rgba(245,158,11,0.10);color:#f59e0b">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </span>
            <span class="drawer-item-label">Scadenze</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'vehicles' }" @click="navigateTo('/vehicles')">
            <span class="drawer-icon" style="background:rgba(37,99,235,0.10);color:#2563eb">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
              </svg>
            </span>
            <span class="drawer-item-label">Veicoli</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'map' }" @click="navigateTo('/map')">
            <span class="drawer-icon" style="background:rgba(168,85,247,0.10);color:#a855f7">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </span>
            <span class="drawer-item-label">Mappa</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'changelog' }" @click="navigateTo('/changelog')">
            <span class="drawer-icon" style="background:rgba(99,102,241,0.10);color:#6366f1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </span>
            <span class="drawer-item-label">Novità</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <div class="drawer-divider"></div>

          <button class="drawer-item" :class="{ active: route.name === 'settings' }" @click="navigateTo('/settings')">
            <span class="drawer-icon" style="background:rgba(100,116,139,0.10);color:#64748b">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </span>
            <span class="drawer-item-label">Impostazioni</span>
            <svg class="drawer-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <div class="drawer-divider"></div>

          <!-- User footer -->
          <div class="drawer-footer">
            <div class="drawer-user">
              <div class="drawer-avatar">{{ (user?.email || 'O')[0].toUpperCase() }}</div>
              <span class="drawer-email">{{ user?.email || 'Ospite' }}</span>
            </div>
            <button class="signout-btn" @click="handleSignOut">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Esci
            </button>
          </div>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.app { min-height: 100dvh; display: flex; flex-direction: column; }

/* ── Header ── */
.header-left { display: flex; align-items: center; gap: 8px; }

.header-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
}

/* ── Offline banner ── */
.offline-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: #fffbeb; border-bottom: 1px solid #fde68a;
  font-size: 12px; font-weight: 500; color: #78350f; line-height: 1.4;
}
.offline-banner svg { width: 14px; height: 14px; flex-shrink: 0; color: #d97706; }
[data-theme="dark"] .offline-banner { background: #1c1208; border-color: #78350f; color: #fcd34d; }
[data-theme="dark"] .offline-banner svg { color: #fbbf24; }
.banner-enter-active, .banner-leave-active { transition: max-height .3s ease, opacity .3s ease; overflow: hidden; }
.banner-enter-from, .banner-leave-to { max-height: 0; opacity: 0; }
.banner-enter-to, .banner-leave-from { max-height: 60px; opacity: 1; }

/* ── Beta banner ── */
.beta-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 11px; color: var(--text-secondary); line-height: 1.4;
}
.beta-pill {
  background: var(--primary-soft); color: var(--primary);
  font-size: 10px; font-weight: 700;
  padding: 1px 7px; border-radius: 20px;
  text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0;
}
[data-theme="dark"] .beta-pill { background: var(--primary-glow); color: #93c5fd; }

/* ── Drawer overlay ── */
.drawer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 1100;
  backdrop-filter: blur(2px);
}
.overlay-enter-active, .overlay-leave-active { transition: opacity .2s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }

/* ── Drawer panel ── */
.drawer {
  position: fixed; z-index: 1101;
  background: var(--bg-card);
  bottom: 0; left: 0; right: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  box-shadow: 0 -8px 40px rgba(0,0,0,0.12);
  border-top: 1px solid var(--border);
}
.drawer-enter-active, .drawer-leave-active { transition: transform .26s cubic-bezier(.32,.72,0,1); }
.drawer-enter-from, .drawer-leave-to { transform: translateY(100%); }

@media (min-width: 600px) {
  .drawer {
    bottom: auto; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 360px; border-radius: 16px;
    padding-bottom: 8px; border: 1px solid var(--border);
  }
  .drawer-enter-active, .drawer-leave-active { transition: opacity .16s ease, transform .16s ease; }
  .drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translate(-50%, -47%); }
  .drawer-enter-to, .drawer-leave-from { opacity: 1; transform: translate(-50%, -50%); }
}

.drawer-handle {
  width: 36px; height: 4px;
  background: var(--border); border-radius: 2px;
  margin: 10px auto 0;
}
@media (min-width: 600px) { .drawer-handle { display: none; } }

.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
}
.drawer-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }

.drawer-body { padding: 6px 0; }

.drawer-item {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 11px 16px;
  background: none; border: none; cursor: pointer;
  color: var(--text-primary); font-size: 14px; font-weight: 500;
  text-align: left; transition: background .12s;
}
.drawer-item:active { background: var(--bg-secondary); }
.drawer-item.active .drawer-item-label { color: var(--primary); font-weight: 600; }

.drawer-icon {
  width: 34px; height: 34px;
  border-radius: var(--r);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.drawer-icon svg { width: 17px; height: 17px; }

.drawer-item-label { flex: 1; }

.drawer-chevron { width: 14px; height: 14px; color: var(--text-tertiary); flex-shrink: 0; }

.drawer-divider { height: 1px; background: var(--border); margin: 4px 16px; }

.drawer-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px 12px; gap: 12px;
}

.drawer-user { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }

.drawer-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--primary-soft); color: var(--primary);
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
[data-theme="dark"] .drawer-avatar { background: var(--primary-glow); color: #93c5fd; }

.drawer-email {
  font-size: 12px; color: var(--text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.signout-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 12px;
  background: rgba(239,68,68,0.08); color: var(--danger);
  border: none; border-radius: var(--r);
  font-size: 12px; font-weight: 600;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s;
}
.signout-btn:active { background: rgba(239,68,68,0.15); }
.signout-btn svg { width: 14px; height: 14px; }
</style>
