import { ref } from 'vue'

export function useGeolocation() {
  const position = ref(null)
  const address = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function getCurrentPosition() {
    if (!navigator.geolocation) {
      error.value = 'Geolocalizzazione non supportata'
      return null
    }

    loading.value = true
    error.value = null

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          position.value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          // Try to get address using Nominatim (OpenStreetMap - no API key needed)
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  'Accept-Language': 'it'
                }
              }
            )
            const data = await response.json()
            address.value = data.display_name || null
          } catch (e) {
            console.error('Error getting address:', e)
            address.value = null
          }

          loading.value = false
          resolve(position.value)
        },
        (err) => {
          loading.value = false
          switch (err.code) {
            case err.PERMISSION_DENIED:
              error.value = 'Permesso negato per la geolocalizzazione'
              break
            case err.POSITION_UNAVAILABLE:
              error.value = 'Posizione non disponibile'
              break
            case err.TIMEOUT:
              error.value = 'Timeout richiesta posizione'
              break
            default:
              error.value = 'Errore sconosciuto'
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  function clearPosition() {
    position.value = null
    address.value = null
    error.value = null
  }

  return {
    position,
    address,
    loading,
    error,
    getCurrentPosition,
    clearPosition
  }
}
