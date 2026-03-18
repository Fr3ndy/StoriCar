import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './styles/main.css'
import { supabase } from './lib/supabase'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/vehicles', name: 'vehicles', component: () => import('./views/VehiclesView.vue') },
  { path: '/fuel', name: 'fuel', component: () => import('./views/FuelView.vue') },
  { path: '/fuel/add', name: 'fuel-add', component: () => import('./views/FuelAddView.vue') },
  { path: '/fuel/edit/:id', name: 'fuel-edit', component: () => import('./views/FuelAddView.vue') },
  { path: '/expenses', name: 'expenses', component: () => import('./views/ExpensesView.vue') },
  { path: '/expenses/add', name: 'expenses-add', component: () => import('./views/ExpenseAddView.vue') },
  { path: '/expenses/edit/:id', name: 'expenses-edit', component: () => import('./views/ExpenseAddView.vue') },
  { path: '/deadlines', name: 'deadlines', component: () => import('./views/DeadlinesView.vue') },
  { path: '/stats', name: 'stats', component: () => import('./views/StatsView.vue') },
  { path: '/map', name: 'map', component: () => import('./views/MapView.vue') },
  { path: '/fuel-prices', name: 'fuel-prices', component: () => import('./views/FuelPricesView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

console.log('[main] app avviata - base URL:', import.meta.env.BASE_URL)

// Attende che Supabase abbia una sessione valida (con timeout)
function waitForSession(timeoutMs = 3000) {
  return new Promise((resolve) => {
    // Prima controlla subito
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolve(data.session)
        return
      }

      // Nessuna sessione immediata: aspetta onAuthStateChange per max timeoutMs
      const timer = setTimeout(() => resolve(null), timeoutMs)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          clearTimeout(timer)
          subscription.unsubscribe()
          resolve(session)
        }
      })
    })
  })
}

// Rotte accessibili solo con account (non agli ospiti)
const AUTH_ONLY_ROUTES = ['map', 'fuel-prices']

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()
  let auth    = !!session
  const guest = localStorage.getItem('storicar_guest') === '1'
  console.log('[router] navigazione verso:', to.name, '| auth:', auth, '| guest:', guest)

  // Se non c'è sessione ma c'è un token in localStorage (OAuth appena completato),
  // aspettiamo un momento che Supabase inizializzi la sessione
  if (!auth && !guest) {
    // Deriva il project ref dall'URL Supabase (già in env) invece di hardcodarlo
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const projectRef  = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
    const storageKey  = 'sb-' + projectRef + '-auth-token'
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.access_token && parsed.expires_at > Math.floor(Date.now() / 1000)) {
          const sess = await waitForSession(2000)
          auth = !!sess
        }
      } catch (e) {}
    }
  }

  const hasAccess = auth || guest

  // Non loggato e non ospite → login
  if (to.name !== 'login' && !hasAccess) return { name: 'login' }

  // Già loggato → non mostrare login
  if (to.name === 'login' && hasAccess) return { name: 'home' }

  // Le rotte AUTH_ONLY sono raggiungibili anche come guest,
  // ma le viste mostrano un AuthWall che invita al login
})

const app = createApp(App)
app.use(router)
app.mount('#app')
console.log('[main] Vue app montata')
