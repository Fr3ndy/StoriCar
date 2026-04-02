<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useStorage } from '../composables/useStorage'
import { useAuth } from '../composables/useAuth'
import AuthWall from '../components/AuthWall.vue'

const { getSetting, data: storageData } = useStorage()
const { isGuest } = useAuth()

// ── Stato ─────────────────────────────────────────────────────────────────────
const loading         = ref(false)
const error           = ref(null)
const data            = ref(null)
const userLat         = ref(null)
const userLng         = ref(null)
const locating        = ref(false)
const selectedId      = ref(null)
const selectedFuel    = ref('Benzina')
// Messaggio contestuale sulla fonte delle coordinate
const coordSource     = ref(null) // null | 'gps' | 'settings' | 'lastRefuel' | 'manual'

// ── Raggio: cap a 100 km, fallback 100 se null/0 ──────────────────────────────
function getRadius() {
  const raw = getSetting('fuelMapRadius')
  if (!raw || raw <= 0) return 100
  return Math.min(raw, 100)
}

// ── Validazione coordinate ─────────────────────────────────────────────────────
function isValidCoord(lat, lng) {
  // Rifiuta null, undefined, NaN, e la coppia (0,0) che indica coordinate non impostate
  if (lat == null || lng == null) return false
  const n_lat = Number(lat), n_lng = Number(lng)
  if (isNaN(n_lat) || isNaN(n_lng)) return false
  if (n_lat === 0 && n_lng === 0) return false // (0,0) = non impostato
  return n_lat >= -90 && n_lat <= 90 && n_lng >= -180 && n_lng <= 180
}

// ── Mappa ─────────────────────────────────────────────────────────────────────
const mapContainer = ref(null)
let map            = null
let clusterLayer   = null
let userMarker     = null
const markers      = {}

// ── GPS dispositivo ───────────────────────────────────────────────────────────
async function getPosition() {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
  )
}

// ── Strategia fallback coordinate ─────────────────────────────────────────────
// Priorità: 1) coordinate manuali già in userLat/userLng
//            2) settings.fuelMapLat / fuelMapLng
//            3) geolocalizzazione dispositivo
//            4) ultimo rifornimento con coordinate
//            5) nessuna chiamata API
async function resolveCoordinates() {
  // 1. Coordinate già acquisite manualmente (tramite locateMe)
  if (isValidCoord(userLat.value, userLng.value)) {
    console.info('[FuelPrices] Fonte coordinate: manuale (già presenti)', { lat: userLat.value, lng: userLng.value })
    coordSource.value = 'manual'
    return { lat: userLat.value, lng: userLng.value }
  }

  // 2. Settings salvate dall'utente
  const settingsLat = getSetting('fuelMapLat')
  const settingsLng = getSetting('fuelMapLng')
  if (isValidCoord(Number(settingsLat), Number(settingsLng))) {
    console.info('[FuelPrices] Fonte coordinate: settings', { settingsLat, settingsLng })
    userLat.value = Number(settingsLat)
    userLng.value = Number(settingsLng)
    coordSource.value = 'settings'
    return { lat: userLat.value, lng: userLng.value }
  } else {
    console.info('[FuelPrices] settings.fuelMapLat/Lng non validi:', { settingsLat, settingsLng })
  }

  // 3. Geolocalizzazione dispositivo
  if (navigator.geolocation) {
    locating.value = true
    try {
      const pos = await getPosition()
      userLat.value = pos.coords.latitude
      userLng.value = pos.coords.longitude
      console.info('[FuelPrices] Fonte coordinate: GPS dispositivo', { lat: userLat.value, lng: userLng.value })
      coordSource.value = 'gps'
      return { lat: userLat.value, lng: userLng.value }
    } catch (geoErr) {
      console.warn('[FuelPrices] Geolocalizzazione fallita:', geoErr.message)
    } finally {
      locating.value = false
    }
  }

  // 4. Ultimo rifornimento con coordinate
  const records = storageData.value?.fuelRecords ?? []
  const withCoord = records
    .filter(r => r.location && isValidCoord(Number(r.location.lat), Number(r.location.lng)))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  if (withCoord.length > 0) {
    const last = withCoord[0]
    userLat.value = Number(last.location.lat)
    userLng.value = Number(last.location.lng)
    console.info('[FuelPrices] Fonte coordinate: ultimo rifornimento', { lat: userLat.value, lng: userLng.value, date: last.date })
    coordSource.value = 'lastRefuel'
    return { lat: userLat.value, lng: userLng.value }
  }

  // 5. Nessuna fonte disponibile
  console.warn('[FuelPrices] Nessuna fonte coordinate disponibile. Chiamata API bloccata.', {
    'settings.fuelMapLat': settingsLat,
    'settings.fuelMapLng': settingsLng,
    'geolocazione': 'fallita/non disponibile',
    'ultimi rifornimenti con coordinate': withCoord.length
  })
  coordSource.value = null
  return null
}

// ── API ───────────────────────────────────────────────────────────────────────
async function load(refresh = false) {
  const base = import.meta.env.VITE_FUEL_PRICES_URL
  if (!base) {
    error.value = 'Servizio prezzi non disponibile.'
    return
  }

  loading.value = true
  error.value   = null

  try {
    const km     = getRadius()
    const coords = await resolveCoordinates()

    // Blocco esplicito se coordinate non disponibili
    if (!coords) {
      error.value = 'Posizione non disponibile. Impossibile caricare i prezzi carburante.'
      return
    }

    const { lat, lng } = coords
    const params = new URLSearchParams({ lat, lng, km })
    if (refresh) params.set('refresh', '1')
    const res = await fetch(`${base}?${params}`)
    if (!res.ok) throw new Error(`Errore server (${res.status})`)
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Errore server')
    data.value = json
    nextTick(() => updateMarkers())
  } catch (e) {
    error.value = e.message || 'Errore di rete'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await load()
  await nextTick()
  initMap()
})

onUnmounted(() => { if (map) { map.remove(); map = null } })

// ── Famiglie carburanti (chip → nomi API MIMIT equivalenti) ───────────────────
const FUEL_FAMILIES = {
  'Benzina': ['Benzina', 'Blue Super', 'HiQ Perform+'],
  'Gasolio': ['Gasolio', 'Blue Diesel', 'HVOlution', 'HVO', 'Gasolio Premium', 'Supreme Diesel', 'Hi-Q Diesel'],
  'Metano':  ['Metano'],
  'GPL':     ['GPL'],
  'L-GNC':   ['L-GNC'],
  'GNL':     ['GNL'],
}

// ── Computed ──────────────────────────────────────────────────────────────────
const impianti   = computed(() => data.value?.impianti ?? [])
const allStats   = computed(() => data.value?.stats ?? {})
const aggiornato = computed(() => data.value?.aggiornato ?? null)
const totale     = computed(() => data.value?.totale ?? 0)

// Chip visibili: solo famiglie per cui l'API ha restituito almeno un membro
const carburanti = computed(() => {
  const apiList = data.value?.carburanti ?? ['Benzina', 'Gasolio']
  return Object.keys(FUEL_FAMILIES).filter(family =>
    FUEL_FAMILIES[family].some(f => apiList.includes(f))
  )
})

// Membri della famiglia del carburante selezionato
const selectedFamilyMembers = computed(() =>
  FUEL_FAMILIES[selectedFuel.value] ?? [selectedFuel.value]
)

// ── Warning prezzi non aggiornati ─────────────────────────────────────────────
const todayStr = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

/**
 * Restituisce true se la data del prezzo (stringa DD/MM/YYYY o ISO) è oggi.
 * Ritorna false se la data è assente o non parseable (considerata non aggiornata).
 */
function isPriceToday(dateStr) {
  if (!dateStr) return false
  // Supporta sia DD/MM/YYYY che YYYY-MM-DD
  let isoDate = dateStr
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/')
    isoDate = `${y}-${m}-${d}`
  }
  return isoDate === todayStr
}

/**
 * Controlla se almeno uno dei prezzi di un impianto è aggiornato oggi.
 * Restituisce anche la data più recente trovata tra i prezzi del carburante selezionato.
 */
function impiantoDateInfo(imp) {
  const prezzi = imp.prezzi ?? {}
  let anyToday = false
  let latestDate = null
  for (const [, p] of Object.entries(prezzi)) {
    if (p.data) {
      if (isPriceToday(p.data)) anyToday = true
      if (!latestDate || p.data > latestDate) latestDate = p.data
    }
  }
  return { anyToday, latestDate }
}

/**
 * Warning GLOBALE: true solo se NESSUN impianto ha prezzi aggiornati oggi.
 * Se almeno uno è aggiornato, non mostrare il warning globale.
 */
const hasGlobalPriceWarning = computed(() => {
  if (!impianti.value.length) return false
  return !impianti.value.some(imp => impiantoDateInfo(imp).anyToday)
})

/**
 * Per ciascun impianto, restituisce la data formattata se non è aggiornata oggi.
 * Usato per il badge "Prezzo non aggiornato" sul singolo distributore.
 */
function getImpiantoWarning(imp) {
  const { anyToday, latestDate } = impiantoDateInfo(imp)
  if (anyToday || !latestDate) return null
  // Formatta in DD/MM/YYYY se necessario
  if (/^\d{4}-\d{2}-\d{2}/.test(latestDate)) {
    const [y, m, d] = latestDate.split('-')
    return `Dato del ${d}/${m}/${y}`
  }
  return `Dato del ${latestDate}`
}

const statsFuel  = computed(() => allStats.value[selectedFuel.value] ?? null)
const mediaself  = computed(() => statsFuel.value?.self?.media ?? null)

const selectedImp = computed(() =>
  selectedId.value ? impianti.value.find(i => i.id === selectedId.value) : null
)

function fmt(n) {
  if (n == null) return '–'
  return n.toFixed(3).replace('.', ',')
}

function getSelf(imp) {
  let best = null
  for (const m of selectedFamilyMembers.value) {
    const p = imp.prezzi?.[m]?.self ?? null
    if (p != null && (best === null || p < best)) best = p
  }
  return best
}

function prezzoColore(selfVal) {
  if (selfVal == null || mediaself.value == null) return '#64748b'
  if (selfVal <= mediaself.value - 0.02) return '#16a34a'
  if (selfVal >= mediaself.value + 0.02) return '#dc2626'
  return '#d97706'
}

function prezzoLabel(imp) {
  let bestSelf = null, bestServ = null
  for (const m of selectedFamilyMembers.value) {
    const p = imp.prezzi?.[m]
    if (!p) continue
    if (p.self != null && (bestSelf === null || p.self < bestSelf)) bestSelf = p.self
    if (p.servito != null && (bestServ === null || p.servito < bestServ)) bestServ = p.servito
  }
  if (bestSelf != null) return fmt(bestSelf)
  if (bestServ != null) return fmt(bestServ)
  return '?'
}

function switchFuel(fuel) {
  selectedFuel.value = fuel
  selectedId.value = null
  nextTick(() => updateMarkers())
}

// ── GPS manuale ───────────────────────────────────────────────────────────────
async function locateMe() {
  locating.value = true
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
    )
    userLat.value = pos.coords.latitude
    userLng.value = pos.coords.longitude
    if (map) {
      map.setView([userLat.value, userLng.value], 14)
      if (userMarker) { userMarker.remove(); userMarker = null }
      userMarker = L.circleMarker([userLat.value, userLng.value], {
        radius: 9, fillColor: '#2563eb', color: 'white', weight: 2.5, fillOpacity: 1, zIndexOffset: 1000
      }).bindTooltip('La tua posizione', { permanent: false }).addTo(map)
    }
  } catch {
    alert('Impossibile ottenere la posizione GPS.')
  } finally {
    locating.value = false
  }
}

// ── Mappa ─────────────────────────────────────────────────────────────────────
function initMap() {
  if (!mapContainer.value || map) return
  const center = userLat.value != null
    ? [userLat.value, userLng.value]
    : [41.90, 12.49] // fallback solo visivo, nessuna richiesta API senza GPS
  map = L.map(mapContainer.value, { zoomControl: false }).setView(center, 12)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  // Cluster layer con icona personalizzata che mostra il prezzo minimo
  clusterLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    iconCreateFunction(cluster) {
      const children = cluster.getAllChildMarkers()
      // Trova il prezzo minimo self del carburante selezionato tra i figli
      let minPrice = null
      for (const m of children) {
        const val = m._fuelSelfVal
        if (val != null && (minPrice == null || val < minPrice)) minPrice = val
      }
      const count = cluster.getChildCount()
      const color = minPrice != null ? prezzoColore(minPrice) : '#64748b'
      const label = minPrice != null ? fmt(minPrice) : count
      return L.divIcon({
        className: '',
        html: `<div style="
          background:${color};
          color:white;
          font-weight:800;
          border-radius:20px;
          padding:5px 10px;
          font-size:11px;
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,.35);
          border:2px solid white;
          display:flex;
          align-items:center;
          gap:4px;
          width:max-content;
        ">
          <span style="font-weight: 400;">${count}×</span>${label}
        </div>`,
        iconAnchor: [28, 14],
      })
    }
  })
  clusterLayer.addTo(map)

  // Marker utente se GPS già rilevato
  if (userLat.value != null) {
    userMarker = L.circleMarker([userLat.value, userLng.value], {
      radius: 9, fillColor: '#2563eb', color: 'white', weight: 2.5, fillOpacity: 1, zIndexOffset: 1000
    }).bindTooltip('La tua posizione', { permanent: false }).addTo(map)
  }

  updateMarkers()
}

function makeIcon(imp) {
  const color = prezzoColore(getSelf(imp))
  const label = prezzoLabel(imp)
  const isSelected = imp.id === selectedId.value
  const size = isSelected
    ? 'font-size:11px;padding:4px 7px;box-shadow:0 0 0 3px white,0 0 0 5px ' + color
    : 'font-size:10px;padding:2px 5px'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:max-content;color:white;font-weight:700;border-radius:6px;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,.3);${size}">${label}</div>`,
    iconAnchor: [20, 10],
    popupAnchor: [0, -14],
  })
}

function updateMarkers() {
  if (!clusterLayer || !impianti.value.length) return
  clusterLayer.clearLayers()
  Object.keys(markers).forEach(k => delete markers[k])

  impianti.value.forEach(imp => {
    if (!imp.lat || !imp.lng) return
    const marker = L.marker([imp.lat, imp.lng], { icon: makeIcon(imp) })
    // Salva il prezzo self sull'oggetto marker per usarlo nel cluster icon
    marker._fuelSelfVal = getSelf(imp)
    marker.on('click', () => selectImp(imp.id))
    clusterLayer.addLayer(marker)
    markers[imp.id] = marker
  })
}

function refreshMarkerIcon(id) {
  const imp = impianti.value.find(i => i.id === id)
  if (imp && markers[id]) {
    markers[id]._fuelSelfVal = getSelf(imp)
    markers[id].setIcon(makeIcon(imp))
  }
}

function selectImp(id) {
  const prev = selectedId.value
  selectedId.value = id
  if (prev) refreshMarkerIcon(prev)
  refreshMarkerIcon(id)
  const imp = impianti.value.find(i => i.id === id)
  if (imp && map) map.setView([imp.lat, imp.lng], Math.max(map.getZoom(), 15), { animate: true })
}

function openMaps(imp) {
  window.open(`https://www.google.com/maps/search/?api=1&query=${imp.lat},${imp.lng}`, '_blank')
}

function closePanel() {
  const prev = selectedId.value
  selectedId.value = null
  if (prev) refreshMarkerIcon(prev)
}

// Data aggiornamento: primo membro della famiglia con data disponibile
function panelDate(imp) {
  for (const m of selectedFamilyMembers.value) {
    const d = imp?.prezzi?.[m]?.data
    if (d) return d
  }
  return null
}

// Stats per famiglia: primo membro con dati self disponibili
function familyStats(family) {
  const members = FUEL_FAMILIES[family] ?? [family]
  for (const m of members) {
    if (allStats.value[m]?.self) return allStats.value[m]
  }
  return null
}

watch(selectedId, (newId, oldId) => {
  if (oldId) refreshMarkerIcon(oldId)
  if (newId) refreshMarkerIcon(newId)
})
</script>

<template>
  <div class="prices-view">

    <!-- Auth wall per ospiti -->
    <AuthWall
      v-if="isGuest"
      title="Prezzi carburante"
      description="Visualizza i prezzi aggiornati dei distributori nella tua zona. Richiede un account."
      feature-name="i prezzi carburante in tempo reale"
      icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />

    <template v-if="!isGuest">

    <!-- Errore -->
    <div v-if="error" class="error-banner">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      {{ error }}
      <button @click="load(true)">Riprova</button>
    </div>

    <!-- Info fonte coordinate (solo se fallback ultimo rifornimento) -->
    <div v-if="coordSource === 'lastRefuel' && !error" class="info-banner">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Prezzi vicino all'ultimo rifornimento registrato
    </div>

    <!-- Warning globale prezzi non aggiornati -->
    <div v-if="hasGlobalPriceWarning && !error && impianti.length" class="warning-banner">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      Attenzione: i prezzi carburante disponibili non sono aggiornati a oggi e potrebbero non essere più validi.
    </div>

    <!-- Mappa con selettore carburante compatto sovrapposto -->
    <div class="map-wrap">
      <div ref="mapContainer" class="map-container"></div>

      <!-- Selettore carburante: piccolo, in alto a destra sulla mappa -->
      <div class="fuel-selector-overlay">
        <button
          v-for="f in carburanti" :key="f"
          class="fuel-chip" :class="{ active: selectedFuel === f }"
          @click="switchFuel(f)"
        >{{ f }}</button>
      </div>

      <!-- Legenda -->
      <div class="map-legend">
        <span class="leg-dot" style="background:#16a34a"></span>Conveniente
        <span class="leg-dot" style="background:#d97706"></span>Media
        <span class="leg-dot" style="background:#dc2626"></span>Caro
      </div>
    </div>

    <!-- Barra in alto: GPS + refresh + meta -->
    <div class="top-bar">
      <div class="top-meta">
        <span v-if="loading" class="spinner-sm"></span>
        <span v-if="aggiornato && !loading">{{ totale }} impianti · agg. {{ aggiornato }}</span>
        <span v-else-if="loading">Caricamento...</span>
      </div>
      <div class="top-actions">
        <button class="icon-btn" @click="locateMe" :disabled="locating" :class="{ active: userLat }" title="Vai alla mia posizione">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </button>
        <button class="icon-btn" @click="load(true)" :disabled="loading" title="Aggiorna dati">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        </button>
      </div>
    </div>

    <!-- Dettaglio stazione selezionata: subito sotto la mappa -->
    <Transition name="slide-up">
      <div v-if="selectedImp" class="detail-panel">
        <button class="panel-close" @click="closePanel">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <div class="panel-header">
          <div class="panel-brand-dot" :style="{ background: prezzoColore(getSelf(selectedImp)) }"></div>
          <div>
            <div class="panel-name">{{ selectedImp.nome }}</div>
            <div class="panel-brand">{{ selectedImp.bandiera }}</div>
          </div>
          <button
            class="maps-btn"
            @click="openMaps(selectedImp)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Maps
          </button>
        </div>
        <div class="panel-prices">
          <template v-for="carb in selectedFamilyMembers" :key="carb">
            <template v-if="selectedImp.prezzi?.[carb]">
              <div v-if="selectedImp.prezzi[carb].self != null" class="panel-price-row is-selected-fuel">
                <span class="panel-price-type">{{ carb }} <span class="price-mode">self</span></span>
                <span class="panel-price-val" :style="{ color: prezzoColore(selectedImp.prezzi[carb].self) }">{{ fmt(selectedImp.prezzi[carb].self) }} €/L</span>
              </div>
              <div v-if="selectedImp.prezzi[carb].servito != null" class="panel-price-row panel-price-row-sm">
                <span class="panel-price-type">{{ carb }} <span class="price-mode">servito</span></span>
                <span class="panel-price-val" style="color:var(--text-secondary)">{{ fmt(selectedImp.prezzi[carb].servito) }} €/L</span>
              </div>
            </template>
          </template>
        </div>
        <!-- Data aggiornamento + warning se non aggiornato oggi -->
        <div class="panel-meta" v-if="selectedImp.prezzi?.[selectedFuel]?.data">
          Agg. {{ selectedImp.prezzi[selectedFuel].data }}
          <span
            v-if="!isPriceToday(selectedImp.prezzi[selectedFuel].data)"
            class="price-outdated-badge"
          >Prezzo non aggiornato</span>
        </div>
      </div>
    </Transition>


    <!-- Prezzi area per famiglia: in fondo -->
    <div class="stats-section" v-if="carburanti.length && !loading">
      <div class="stats-header">
        <span class="stats-title">Prezzi area · self-service</span>
        <span class="stats-badge">{{ totale }} impianti</span>
      </div>
      <div class="stats-list">
        <div
          v-for="family in carburanti" :key="family"
          class="stats-row-item"
          :class="{ 'stats-row-active': family === selectedFuel }"
          @click="switchFuel(family)"
          v-if="familyStats(family)"
        >
          <div class="sri-name">{{ family }}</div>
          <div class="sri-prices">
            <span class="sri-min">{{ fmt(familyStats(family).self.min) }}</span>
            <span class="sri-sep">–</span>
            <span class="sri-media">{{ fmt(familyStats(family).self.media) }}</span>
            <span class="sri-sep">–</span>
            <span class="sri-max">{{ fmt(familyStats(family).self.max) }}</span>
          </div>
          <div class="sri-count">{{ familyStats(family).self.count }}</div>
        </div>
      </div>
      <div class="stats-footer">Fonte: MIMIT · Osservatorio Carburanti</div>
    </div>

    </template><!-- /v-if="!isGuest" -->
  </div>
</template>

<style scoped>
.prices-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 24px;
}

/* Top bar */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.top-meta {
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.top-actions { display: flex; gap: 6px; }
.icon-btn {
  width: 34px; height: 34px; border-radius: 10px;
  border: 1.5px solid var(--border); background: var(--bg-card);
  color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.icon-btn svg { width: 16px; height: 16px; }
.icon-btn.active { border-color: #10b981; color: #10b981; background: rgba(16,185,129,0.1); }
.icon-btn:disabled { opacity: 0.45; }

.spinner-sm {
  width: 12px; height: 12px; border: 2px solid var(--border);
  border-top-color: var(--primary); border-radius: 50%;
  animation: spin 0.8s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Error */
.error-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 12px; padding: 12px 14px;
  font-size: 13px; color: #ef4444;
}
.error-banner svg { width: 18px; height: 18px; flex-shrink: 0; }
.error-banner button {
  margin-left: auto; padding: 4px 10px; background: #ef4444; color: white;
  border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
}

/* Mappa */
.map-wrap { position: relative; }
.map-container {
  height: 360px;
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--border);
}

/* Selettore carburante sovrapposto: piccolo, in alto a sx
   right: 52px lascia spazio ai bottoni zoom Leaflet (topright) */
.fuel-selector-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 52px;
  z-index: 500;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.fuel-selector-overlay::-webkit-scrollbar { display: none; }
.fuel-chip {
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 700;
  border: 1.5px solid rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.82);
  color: var(--text-secondary);
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.15s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
.fuel-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
  box-shadow: 0 2px 8px rgba(99,102,241,0.4);
}

.map-legend {
  position: absolute; bottom: 10px; left: 10px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 8px; padding: 4px 9px;
  font-size: 10px; color: #64748b;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.leg-dot {
  width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0;
  margin-left: 5px;
}
.leg-dot:first-child { margin-left: 0; }

/* Dettaglio stazione */
.detail-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px;
  position: relative;
}
.panel-close {
  position: absolute; top: 12px; right: 12px;
  background: var(--bg-secondary); border: none;
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-secondary);
}
.panel-close svg { width: 14px; height: 14px; }
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-right: 32px;
}
.panel-brand-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.panel-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.panel-brand { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.maps-btn {
  margin-left: auto;
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}
.maps-btn svg { width: 13px; height: 13px; }

.panel-prices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}
.panel-price-row {
  display: flex; flex-direction: column;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid transparent;
}
.panel-price-row.is-selected-fuel {
  border-color: var(--border);
}
.panel-price-type {
  font-size: 11px; color: var(--text-secondary); font-weight: 500;
  margin-bottom: 2px;
}
.price-mode {
  font-size: 10px;
  opacity: 0.7;
}
.panel-price-val { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
.panel-price-row-sm .panel-price-val { font-size: 14px; }
.panel-meta { font-size: 11px; color: var(--text-secondary); }


/* Stats in fondo — redesign per famiglia */
.stats-section {
  margin-top: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.stats-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px 10px;
  border-bottom: 1px solid var(--border);
}
.stats-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-secondary);
  flex: 1;
}
.stats-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 2px 8px;
}
.stats-list {
  display: flex;
  flex-direction: column;
}
.stats-row-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
.stats-row-item:last-child { border-bottom: none; }
.stats-row-item:hover { background: var(--bg-secondary); }
.stats-row-item.stats-row-active { background: rgba(99,102,241,0.07); }
.sri-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 60px;
}
.stats-row-active .sri-name { color: var(--primary); }
.sri-prices {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.3px;
  justify-content: center;
}
.sri-min { color: #16a34a; }
.sri-max { color: #dc2626; }
.sri-media { color: var(--text-primary); }
.sri-sep { color: var(--text-secondary); font-size: 10px; font-weight: 400; opacity: 0.5; }
.sri-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 24px;
  text-align: right;
}
.stats-footer {
  font-size: 9px;
  color: var(--text-secondary);
  padding: 5px 14px;
  border-top: 1px solid var(--border);
  opacity: 0.55;
  text-align: center;
}

/* Transizione pannello */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.2s cubic-bezier(0.32,0.72,0,1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }

/* Warning banner: prezzi non aggiornati (globale) */
.warning-banner {
  display: flex; align-items: flex-start; gap: 8px;
  background: rgba(234,179,8,0.10); border: 1px solid rgba(234,179,8,0.35);
  border-radius: 12px; padding: 12px 14px;
  font-size: 13px; color: #92400e;
}
.warning-banner svg { width: 18px; height: 18px; flex-shrink: 0; color: #d97706; margin-top: 1px; }

/* Info banner: fonte coordinate (es. ultimo rifornimento) */
.info-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25);
  border-radius: 12px; padding: 10px 14px;
  font-size: 12px; color: var(--text-secondary);
}
.info-banner svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--primary); }

/* Badge "Prezzo non aggiornato" nel dettaglio stazione */
.price-outdated-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(234,179,8,0.15);
  color: #92400e;
  vertical-align: middle;
}
</style>
