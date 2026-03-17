import { ref, computed } from 'vue'

const PRICES_API = import.meta.env.VITE_FUEL_PRICES_URL || './fuel-prices.php'

const cache = ref(null)
const loading = ref(false)
const error = ref(null)
const lastFetch = ref(null)

export function useFuelPrices() {

  async function fetchPrices({ lat = null, lng = null, km = null, refresh = false } = {}) {
    loading.value = true
    error.value = null

    // Filtriamo solo per GPS lato server (riduce il payload se km piccolo)
    // carburante e comune vengono filtrati lato client per reattività istantanea
    const params = new URLSearchParams()
    if (lat)     params.set('lat', lat)
    if (lng)     params.set('lng', lng)
    if (km)      params.set('km', km)
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
