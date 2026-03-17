<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStorage } from './composables/useStorage'
import { useAuth } from './composables/useAuth'

const router = useRouter()
const route = useRoute()
const { getTheme, setTheme, data, dataReady } = useStorage()
console.log('[App] setup - dataReady iniziale:', dataReady.value)
const { user, signOut } = useAuth()

const currentTheme = computed(() => data.value.settings.theme)
const menuOpen = ref(false)

function toggleTheme() {
  const newTheme = currentTheme.value === 'light' ? 'dark' : 'light'
  setTheme(newTheme)
}

function openMenu() { menuOpen.value = true }
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

const pageTitle = computed(() => {
  const titles = {
    'home': 'Storicar',
    'vehicles': 'Veicoli',
    'fuel': 'Rifornimenti',
    'fuel-add': 'Nuovo Rifornimento',
    'fuel-edit': 'Modifica Rifornimento',
    'expenses': 'Spese',
    'expenses-add': 'Nuova Spesa',
    'expenses-edit': 'Modifica Spesa',
    'deadlines': 'Scadenze',
    'stats': 'Statistiche',
    'map': 'Mappa',
    'fuel-prices': 'Prezzi Carburante',
    'settings': 'Impostazioni'
  }
  return titles[route.name] || 'Storicar'
})

const moreRoutes = ['vehicles', 'stats', 'map', 'settings', 'expenses', 'expenses-add', 'expenses-edit', 'deadlines']
const isMoreActive = computed(() => moreRoutes.includes(route.name))

watch(dataReady, (val) => {
  console.log('[App] dataReady cambiato:', val)
})

onMounted(() => {
  setTheme(getTheme())
  console.log('[App] onMounted - dataReady:', dataReady.value)
})
</script>

<template>
  <div class="app">
    <header v-if="route.name !== 'login'" class="header">
      <div class="header-left">
        <h1>{{ pageTitle }}</h1>
      </div>
      <button class="theme-toggle" @click="toggleTheme" :title="currentTheme === 'light' ? 'Tema scuro' : 'Tema chiaro'">
        <svg v-if="currentTheme === 'light'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
    </header>

    <!-- Beta banner -->
    <div v-if="route.name !== 'login'" class="beta-banner">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
      <span><strong>Beta</strong> — App in sviluppo. I dati potrebbero subire variazioni o perdite senza preavviso.</span>
    </div>

    <main class="main-content">
      <div v-if="route.name !== 'login' && !dataReady" class="loading-screen">
        <div class="loading-spinner"></div>
      </div>
      <router-view v-else />
    </main>

    <!-- Bottom nav -->
    <nav v-if="route.name !== 'login'" class="bottom-nav">
      <router-link to="/" class="nav-item" :class="{ active: route.name === 'home' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span>Home</span>
      </router-link>

      <router-link to="/fuel" class="nav-item" :class="{ active: route.name?.startsWith('fuel') && route.name !== 'fuel-prices' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>Carburante</span>
      </router-link>

      <router-link to="/stats" class="nav-item" :class="{ active: route.name === 'stats' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span>Statistiche</span>
      </router-link>

      <router-link to="/fuel-prices" class="nav-item" :class="{ active: route.name === 'fuel-prices' }">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Prezzi</span>
      </router-link>

      <button class="nav-item" :class="{ active: isMoreActive }" @click="openMenu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        <span>Altro</span>
      </button>
    </nav>

    <!-- More menu drawer -->
    <Transition name="overlay">
      <div v-if="menuOpen" class="drawer-overlay" @click="closeMenu" />
    </Transition>
    <Transition name="drawer">
      <div v-if="menuOpen" class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Menu</span>
          <button class="drawer-close" @click="closeMenu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="drawer-body">
          <button class="drawer-item" :class="{ active: route.name?.startsWith('expenses') }" @click="navigateTo('/expenses')">
            <span class="drawer-item-icon icon-expenses">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            <span class="drawer-item-label">Spese</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'deadlines' }" @click="navigateTo('/deadlines')">
            <span class="drawer-item-icon icon-deadlines">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <span class="drawer-item-label">Scadenze</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'stats' }" @click="navigateTo('/stats')">
            <span class="drawer-item-icon icon-stats">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <span class="drawer-item-label">Statistiche</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div class="drawer-divider"></div>

          <button class="drawer-item" :class="{ active: route.name === 'vehicles' }" @click="navigateTo('/vehicles')">
            <span class="drawer-item-icon icon-vehicles">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4" />
              </svg>
            </span>
            <span class="drawer-item-label">Veicoli</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button class="drawer-item" :class="{ active: route.name === 'map' }" @click="navigateTo('/map')">
            <span class="drawer-item-icon icon-map">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span class="drawer-item-label">Mappa</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div class="drawer-divider"></div>

          <button class="drawer-item" :class="{ active: route.name === 'settings' }" @click="navigateTo('/settings')">
            <span class="drawer-item-icon icon-settings">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span class="drawer-item-label">Impostazioni</span>
            <svg class="drawer-item-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div class="drawer-divider"></div>

          <!-- Logout -->
          <div class="drawer-user">
            <div class="drawer-user-info">
              <span class="drawer-user-email">{{ user?.email }}</span>
            </div>
            <button class="btn-logout" @click="handleSignOut">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* Header icon + title */
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-icon-small svg {
  width: 16px;
  height: 16px;
  color: white;
}

/* Colored drawer icons */
.icon-stats     { background: rgba(37, 99, 235, 0.12)  !important; color: #2563eb !important; }
.icon-expenses  { background: rgba(16, 185, 129, 0.12) !important; color: #10b981 !important; }
.icon-deadlines { background: rgba(245, 158, 11, 0.12) !important; color: #f59e0b !important; }
.icon-prices    { background: rgba(14, 165, 233, 0.12) !important; color: #0ea5e9 !important; }
.icon-vehicles  { background: rgba(37, 99, 235, 0.12)  !important; color: #2563eb !important; }
.icon-map       { background: rgba(168, 85, 247, 0.12) !important; color: #a855f7 !important; }
.icon-settings  { background: rgba(100, 116, 139, 0.12) !important; color: #64748b !important; }

/* ── Drawer overlay ── */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1100;
  backdrop-filter: blur(2px);
}

/* ── Drawer panel — mobile: bottom sheet, desktop: centrato ── */
.drawer {
  position: fixed;
  z-index: 1101;
  background: var(--bg-card);
  box-shadow: 0 -4px 32px var(--shadow);

  /* mobile: sale dal basso */
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 20px 20px 0 0;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.drawer-close {
  background: var(--bg-secondary);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
}
.drawer-close svg { width: 18px; height: 18px; }

.drawer-body {
  padding: 8px 0;
}

.drawer-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 1rem;
  text-align: left;
  transition: background 0.15s;
}
.drawer-item:active { background: var(--bg-secondary); }
.drawer-item.active .drawer-item-label { color: var(--primary); font-weight: 600; }

.drawer-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.drawer-item-icon svg { width: 20px; height: 20px; }

.drawer-item.active .drawer-item-icon {
  background: var(--primary);
  color: #fff;
}

.drawer-item-label {
  flex: 1;
  color: var(--text-primary);
}

.drawer-item-arrow {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.drawer-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 20px;
}

.drawer-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 16px;
  gap: 12px;
}

.drawer-user-info {
  flex: 1;
  min-width: 0;
}

.drawer-user-email {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: none;
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  flex-shrink: 0;
}
.btn-logout svg { width: 16px; height: 16px; }
.btn-logout:hover { background: rgba(239, 68, 68, 0.08); }

/* Beta banner */
.beta-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  font-size: 12px;
  color: #92400e;
  line-height: 1.4;
}
.beta-banner svg { width: 15px; height: 15px; flex-shrink: 0; color: #d97706; }
[data-theme="dark"] .beta-banner {
  background: #1c1208;
  border-bottom-color: #78350f;
  color: #fcd34d;
}
[data-theme="dark"] .beta-banner svg { color: #fbbf24; }

/* ── Desktop: modal centrato ── */
@media (min-width: 600px) {
  .drawer {
    bottom: auto;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 360px;
    border-radius: 16px;
    padding-bottom: 8px;
  }
}

/* ── Transitions ── */
.overlay-enter-active,
.overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from,
.overlay-leave-to { opacity: 0; }

/* mobile: slide su dal basso */
.drawer-enter-active,
.drawer-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.drawer-enter-from,
.drawer-leave-to { transform: translateY(100%); }

/* desktop: fade+scale invece di slide */
@media (min-width: 600px) {
  .drawer-enter-active,
  .drawer-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
  .drawer-enter-from,
  .drawer-leave-to { opacity: 0; transform: translate(-50%, -48%); }
  .drawer-enter-to,
  .drawer-leave-from { opacity: 1; transform: translate(-50%, -50%); }
}

/* Loading screen */
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 200px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
