/**
 * useNotifications.js
 * Gestisce le notifiche browser per le scadenze imminenti.
 * - Chiede il permesso all'utente
 * - Controlla le scadenze all'avvio e ogni volta che l'app torna in primo piano
 * - Evita duplicati tramite localStorage (traccia quale scadenza è già stata notificata)
 */
import { ref, readonly } from 'vue'

const NOTIFIED_KEY  = 'storicar_notified_deadlines'
const CHECK_KEY     = 'storicar_last_notif_check'
const CHECK_INTERVAL = 6 * 60 * 60 * 1000 // non richiamare più di ogni 6h

const permission = ref(typeof Notification !== 'undefined' ? Notification.permission : 'denied')

// ── Helpers ────────────────────────────────────────────────
function getNotified() {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}') } catch { return {} }
}

function markNotified(id, expiryDate) {
  const n = getNotified()
  n[id] = expiryDate
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(n))
}

function pruneOldNotified() {
  const n     = getNotified()
  const today = new Date().toISOString().slice(0, 10)
  let changed = false
  for (const [id, date] of Object.entries(n)) {
    if (date < today) { delete n[id]; changed = true }
  }
  if (changed) localStorage.setItem(NOTIFIED_KEY, JSON.stringify(n))
}

function canSendAgain() {
  const last = parseInt(localStorage.getItem(CHECK_KEY) || '0', 10)
  return Date.now() - last > CHECK_INTERVAL
}

function markChecked() {
  localStorage.setItem(CHECK_KEY, String(Date.now()))
}

// ── API ────────────────────────────────────────────────────
export function useNotifications() {
  /** Richiede il permesso e restituisce true se concesso */
  async function requestPermission() {
    if (typeof Notification === 'undefined') return false
    const result = await Notification.requestPermission()
    permission.value = result
    return result === 'granted'
  }

  /**
   * Controlla le scadenze imminenti e mostra notifiche browser.
   * @param {Array}  deadlines    - array di scadenze da useStorage
   * @param {number} notifyDays   - giorni di anticipo
   * @param {Array}  vehicles     - array veicoli (per il nome nel titolo)
   */
  function checkDeadlines(deadlines, notifyDays = 30, vehicles = []) {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (!canSendAgain()) return

    pruneOldNotified()
    markChecked()

    const notified = getNotified()
    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    const limit    = new Date(today)
    limit.setDate(limit.getDate() + notifyDays)

    const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v.name]))

    for (const d of deadlines) {
      if (notified[d.id]) continue // già notificata

      const expiry = new Date(d.expiryDate)
      expiry.setHours(0, 0, 0, 0)

      if (expiry <= today) {
        // Scaduta
        showNotification(
          `⚠️ Scadenza scaduta: ${d.type || d.description}`,
          {
            body:    `${vehicleMap[d.vehicleId] ? vehicleMap[d.vehicleId] + ' · ' : ''}Scaduta il ${formatDate(expiry)}`,
            tag:     `deadline-${d.id}`,
            icon:    '/icon-192.png',
            badge:   '/icon-96.png',
          }
        )
        markNotified(d.id, d.expiryDate)
      } else if (expiry <= limit) {
        // Imminente
        const diffDays = Math.round((expiry - today) / 86400000)
        showNotification(
          `🔔 Scadenza imminente: ${d.type || d.description}`,
          {
            body:    `${vehicleMap[d.vehicleId] ? vehicleMap[d.vehicleId] + ' · ' : ''}Scade ${diffDays === 0 ? 'oggi' : `tra ${diffDays} giorn${diffDays === 1 ? 'o' : 'i'}`}`,
            tag:     `deadline-${d.id}`,
            icon:    '/icon-192.png',
            badge:   '/icon-96.png',
          }
        )
        markNotified(d.id, d.expiryDate)
      }
    }
  }

  function showNotification(title, options = {}) {
    // Preferisci il service worker (funziona anche con app in background)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { ...options, vibrate: [200, 100, 200] })
      }).catch(() => {
        new Notification(title, options)
      })
    } else {
      new Notification(title, options)
    }
  }

  function formatDate(date) {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return {
    permission: readonly(permission),
    requestPermission,
    checkDeadlines,
  }
}
