import { ref, computed } from 'vue'

const PRICES_API = import.meta.env.VITE_FUEL_PRICES_URL

const cache = ref(null)
const loading = ref(false)
const error = ref(null)
const lastFetch = ref(null)

// Raggio massimo consentito (spec Storicar)
const MAX_RADIUS_KM = 100

/** Verifica che lat/lng siano numeri nei range geografici validi.
 *  Rifiuta (0,0) che indica coordinate non impostate (null → Number = 0). */
function isValidCoord(lat, lng) {
  if (lat == null || lng == null) return false
  const n_lat = Number(lat), n_lng = Number(lng)
  if (isNaN(n_lat) || isNaN(n_lng)) return false
  if (n_lat === 0 && n_lng === 0) return false
  return n_lat >= -90 && n_lat <= 90 && n_lng >= -180 && n_lng <= 180
}

export function useFuelPrices() {

  async function fetchPrices({ lat = null, lng = null, km = null, refresh = false } = {}) {
    // ── Validazione coordinate obbligatoria ─────────────────────────────
    const latNum = lat != null ? Number(lat) : null
    const lngNum = lng != null ? Number(lng) : null

    if (!isValidCoord(latNum, lngNum)) {
      // Diagnostica in console (utile per debug, non esposta in UI)
      console.warn('[useFuelPrices] Chiamata bloccata: coordinate non valide.', {
        lat, lng,
        motivo: lat == null || lng == null ? 'coordinate null/undefined' : 'valori fuori range o non numerici'
      })
      // Non impostare error.value qui: il chiamante gestisce il messaggio UI
      return null
    }

    // ── Cap raggio a MAX_RADIUS_KM ───────────────────────────────────────
    const radiusKm = km != null ? Math.min(Math.max(1, Number(km)), MAX_RADIUS_KM) : MAX_RADIUS_KM

    loading.value = true
    error.value = null

    // Filtriamo solo per GPS lato server (riduce il payload se km piccolo)
    // carburante e comune vengono filtrati lato client per reattività istantanea
    const params = new URLSearchParams()
    params.set('lat', latNum)
    params.set('lng', lngNum)
    params.set('km', radiusKm)
    if (refresh) params.set('refresh', '1')
    params.set('max', '500')

    try {
      const res = await fetch(`${PRICES_API}?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Errore server')
      cache.value = data
      lastFetch.value = new Date()
      return data
    } catch (e) {
      error.value = e.message || 'Errore di rete'
      return null
    } finally {
      loading.value = false
    }
  }

  const impianti = computed(() => cache.value?.impianti ?? [])
  const statistiche = computed(() => cache.value?.statistiche ?? {})
  const tipiCarburante = computed(() => cache.value?.tipi_carburante ?? [])
  const totaleImpianti = computed(() => cache.value?.totale_impianti ?? 0)
  const aggiornato = computed(() => cache.value?.aggiornato ?? null)

  return {
    loading,
    error,
    lastFetch,
    impianti,
    statistiche,
    tipiCarburante,
    totaleImpianti,
    aggiornato,
    fetchPrices
  }
}
