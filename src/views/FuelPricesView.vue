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

// ── Brand config: colori + abbreviazioni + dominio logo ───────────────────────
const BRAND_CONFIG = {
  'ENI':           { color: '#00a84f', short: 'ENI',  domain: 'eni.com' },
  'Agip':          { color: '#00a84f', short: 'AGP',  domain: 'eni.com' },
  'Q8':            { color: '#e30613', short: 'Q8',   domain: 'q8.it' },
  'IP':            { color: '#0066cc', short: 'IP',   domain: 'apienergia.it' },
  'ERG':           { color: '#f97316', short: 'ERG',  domain: 'erg.eu' },
  'Esso':          { color: '#003087', short: 'ESS',  domain: 'esso.it' },
  'Shell':         { color: '#dd1d21', short: 'SHL',  domain: 'shell.it' },
  'Tamoil':        { color: '#e30613', short: 'TAM',  domain: 'tamoil.it' },
  'TotalEnergies': { color: '#e30613', short: 'TOT',  domain: 'totalenergies.it' },
  'Total':         { color: '#e30613', short: 'TOT',  domain: 'totalenergies.it' },
  'Api':           { color: '#009fe3', short: 'API',  domain: 'apienergia.it' },
  'Socar':         { color: '#006bb6', short: 'SOC',  domain: 'socar.it' },
  'Costante':      { color: '#7c3aed', short: 'CST',  domain: null },
  'Retitalia':     { color: '#0891b2', short: 'RTL',  domain: null },
}

function getBrand(bandiera) {
  if (!bandiera) return null
  // Match esatto o parziale case-insensitive
  const key = Object.keys(BRAND_CONFIG).find(k =>
    bandiera.toLowerCase().includes(k.toLowerCase())
  )
  return key ? BRAND_CONFIG[key] : null
}

function brandColor(bandiera) {
  return getBrand(bandiera)?.color ?? '#64748b'
}

function brandShort(bandiera) {
  if (!bandiera) return '?'
  const b = getBrand(bandiera)
  if (b) return b.short
  // Fallback: primi 3 caratteri uppercase
  return bandiera.replace(/\s+/g, '').slice(0, 3).toUpperCase()
}

function brandLogoUrl(bandiera) {
  const domain = getBrand(bandiera)?.domain
  if (!domain) return null
  return `https://logo.clearbit.com/${domain}`
}

// ── Stato ─────────────────────────────────────────────────────────────────────
const loading         = ref(false)
const error           = ref(null)
const data            = ref(null)
const userLat         = ref(null)
const userLng         = ref(null)
const locating        = ref(false)
const selectedId      = ref(null)
const selectedFuel    = ref('Benzina')
const coordSource     = ref(null) // null | 'gps' | 'settings' | 'lastRefuel' | 'manual'
const logoErrors      = ref(new Set()) // brand domains che hanno fallito il caricamento logo

// ── Raggio: cap a 100 km, fallback 100 se null/0 ──────────────────────────────
function getRadius() {
  const raw = getSetting('fuelMapRadius')
  if (!raw || raw <= 0) return 100
  return Math.min(raw, 100)
}

// ── Validazione coordinate ─────────────────────────────────────────────────────
function isValidCoord(lat, lng) {
  if (lat == null || lng == null) return false
  const n_lat = Number(lat), n_lng = Number(lng)
  if (isNaN(n_lat) || isNaN(n_lng)) return false
  if (n_lat === 0 && n_lng === 0) return false
  return n_lat >= -90 && n_lat <= 90 && n_lng >= -180 && n_lng <= 180
}

// ── Mappa ─────────────────────────────────────────────────────────────────────
const mapContainer = ref(null)
let map            = null
let clusterLayer   = null
let userMarker     = null
let radiusCircle   = null
const markers      = {}

// ── GPS dispositivo ───────────────────────────────────────────────────────────
async function getPosition() {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
  )
}

// ── Strategia fallback coordinate ─────────────────────────────────────────────
async function resolveCoordinates() {
  if (isValidCoord(userLat.value, userLng.value)) {
    coordSource.value = 'manual'
    return { lat: userLat.value, lng: userLng.value }
  }

  const settingsLat = getSetting('fuelMapLat')
  const settingsLng = getSetting('fuelMapLng')
  if (isValidCoord(Number(settingsLat), Number(settingsLng))) {
    userLat.value = Number(settingsLat)
    userLng.value = Number(settingsLng)
    coordSource.value = 'settings'
    return { lat: userLat.value, lng: userLng.value }
  }

  if (navigator.geolocation) {
    locating.value = true
    try {
      const pos = await getPosition()
      userLat.value = pos.coords.latitude
      userLng.value = pos.coords.longitude
      coordSource.value = 'gps'
      return { lat: userLat.value, lng: userLng.value }
    } catch (geoErr) {
      console.warn('[FuelPrices] Geolocalizzazione fallita:', geoErr.message)
    } finally {
      locating.value = false
    }
  }

  const records = storageData.value?.fuelRecords ?? []
  const withCoord = records
    .filter(r => r.location && isValidCoord(Number(r.location.lat), Number(r.location.lng)))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  if (withCoord.length > 0) {
    const last = withCoord[0]
    userLat.value = Number(last.location.lat)
    userLng.value = Number(last.location.lng)
    coordSource.value = 'lastRefuel'
    return { lat: userLat.value, lng: userLng.value }
  }

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
    nextTick(() => {
      updateMarkers()
      placeRadiusCircle()
    })
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

// ── Famiglie carburanti ───────────────────────────────────────────────────────
const FUEL_FAMILIES = {
  'Benzina': ['Benzina', 'Blue Super', 'HiQ Perform+'],
  'Gasolio': ['Gasolio', 'Blue Diesel', 'HVOlution', 'HVO', 'Gasolio Premium', 'Supreme Diesel', 'Hi-Q Diesel'],
  'Metano':  ['Metano'],
  'GPL':     ['GPL'],
  'L-GNC':   ['L-GNC'],
  'GNL':     ['GNL'],
}

const FUEL_ICONS = {
  'Benzina': '⛽',
  'Gasolio': '🛢️',
  'Metano':  '💨',
  'GPL':     '🔵',
  'L-GNC':   '🌿',
  'GNL':     '❄️',
}

// ── Computed ──────────────────────────────────────────────────────────────────
const impianti   = computed(() => data.value?.impianti ?? [])
const allStats   = computed(() => data.value?.stats ?? {})
const aggiornato = computed(() => data.value?.aggiornato ?? null)
const totale     = computed(() => data.value?.totale ?? 0)

const carburanti = computed(() => {
  const apiList = data.value?.carburanti ?? ['Benzina', 'Gasolio']
  return Object.keys(FUEL_FAMILIES).filter(family =>
    FUEL_FAMILIES[family].some(f => apiList.includes(f))
  )
})

const selectedFamilyMembers = computed(() =>
  FUEL_FAMILIES[selectedFuel.value] ?? [selectedFuel.value]
)

// ── Warning prezzi non aggiornati ─────────────────────────────────────────────
const todayStr = new Date().toLocaleDateString('sv-SE')

function isPriceToday(dateStr) {
  if (!dateStr) return false
  let isoDate = dateStr
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/')
    isoDate = `${y}-${m}-${d}`
  }
  return isoDate.slice(0, 10) === todayStr
}

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

const hasGlobalPriceWarning = computed(() => {
  if (!impianti.value.length) return false
  return !impianti.value.some(imp => impiantoDateInfo(imp).anyToday)
})

function getImpiantoWarning(imp) {
  const { anyToday, latestDate } = impiantoDateInfo(imp)
  if (anyToday || !latestDate) return null
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

function fmtDiff(n) {
  if (n == null) return null
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(3).replace('.', ',')} €`
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

// Etichetta confronto vs media per il pannello dettaglio
function diffVsMedia(selfVal) {
  if (selfVal == null || mediaself.value == null) return null
  return selfVal - mediaself.value
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
      placeUserMarker()
    }
  } catch {
    alert('Impossibile ottenere la posizione GPS.')
  } finally {
    locating.value = false
  }
}

function placeUserMarker() {
  if (!map || userLat.value == null) return
  if (userMarker) { userMarker.remove(); userMarker = null }
  // Outer pulse ring
  const pulseIcon = L.divIcon({
    className: '',
    html: `<div class="user-marker-wrap">
      <div class="user-marker-pulse"></div>
      <div class="user-marker-dot"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
  userMarker = L.marker([userLat.value, userLng.value], {
    icon: pulseIcon,
    zIndexOffset: 1000,
    interactive: false,
  }).addTo(map)
}

function placeRadiusCircle() {
  if (!map || userLat.value == null) return
  if (radiusCircle) { radiusCircle.remove(); radiusCircle = null }
  const km = getRadius()
  radiusCircle = L.circle([userLat.value, userLng.value], {
    radius: km * 1000,
    color: '#6366f1',
    weight: 1.5,
    opacity: 0.35,
    fillColor: '#6366f1',
    fillOpacity: 0.04,
    dashArray: '5 6',
    interactive: false,
  }).addTo(map)
}

// ── Mappa ─────────────────────────────────────────────────────────────────────
function initMap() {
  if (!mapContainer.value || map) return
  const center = userLat.value != null
    ? [userLat.value, userLng.value]
    : [41.90, 12.49]

  map = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
  }).setView(center, 13)

  // Zoom in alto a destra
  L.control.zoom({ position: 'topright' }).addTo(map)

  // Attribution minima in basso a sinistra
  L.control.attribution({ position: 'bottomleft', prefix: false })
    .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> · <a href="https://carto.com" target="_blank">CARTO</a>')
    .addTo(map)

  // Tiles CartoDB Positron: sfondo chiaro e leggibile
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map)

  // Cluster con prezzo minimo e conteggio
  clusterLayer = L.markerClusterGroup({
    maxClusterRadius: 55,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction(cluster) {
      const children = cluster.getAllChildMarkers()
      let minPrice = null
      for (const m of children) {
        const val = m._fuelSelfVal
        if (val != null && (minPrice == null || val < minPrice)) minPrice = val
      }
      const count = cluster.getChildCount()
      const color = minPrice != null ? prezzoColore(minPrice) : '#64748b'
      const label = minPrice != null ? fmt(minPrice) : '–'
      return L.divIcon({
        className: '',
        html: `<div style="
          background:white;
          border:2px solid ${color};
          color:${color};
          font-weight:800;
          border-radius:22px;
          padding:5px 10px 5px 8px;
          font-size:11px;
          white-space:nowrap;
          box-shadow:0 3px 10px rgba(0,0,0,.18);
          display:flex;
          align-items:center;
          gap:5px;
          width:max-content;
          line-height:1;
        ">
          <span style="
            background:${color};
            color:white;
            border-radius:12px;
            padding:1px 6px;
            font-size:10px;
            font-weight:700;
          ">${count}</span>${label}
        </div>`,
        iconAnchor: [30, 16],
      })
    }
  })
  clusterLayer.addTo(map)

  // Cerchio raggio e marker utente
  if (userLat.value != null) {
    placeUserMarker()
    placeRadiusCircle()
  }

  updateMarkers()
}

function makeIcon(imp) {
  const priceColor  = prezzoColore(getSelf(imp))
  const price       = prezzoLabel(imp)
  const bColor      = brandColor(imp.bandiera)
  const bShort      = brandShort(imp.bandiera)
  const isSelected  = imp.id === selectedId.value

  const shadow = isSelected
    ? `0 0 0 2.5px white, 0 0 0 4.5px ${priceColor}, 0 4px 14px rgba(0,0,0,.25)`
    : '0 2px 6px rgba(0,0,0,.18)'

  const scale = isSelected ? 'transform:scale(1.18);' : ''

  return L.divIcon({
    className: '',
    html: `<div style="
      display:flex;
      align-items:stretch;
      background:white;
      border:1.5px solid ${priceColor};
      border-radius:8px;
      overflow:hidden;
      white-space:nowrap;
      box-shadow:${shadow};
      ${scale}
      transition:all .15s;
      width:max-content;
    ">
      <div style="
        background:${bColor};
        color:white;
        font-size:7.5px;
        font-weight:900;
        letter-spacing:0.2px;
        padding:3px 4px;
        display:flex;
        align-items:center;
        justify-content:center;
        min-width:20px;
      ">${bShort}</div>
      <div style="
        padding:3px 6px;
        font-size:11px;
        font-weight:800;
        color:${priceColor};
        display:flex;
        align-items:center;
      ">${price}</div>
    </div>`,
    iconAnchor: [24, 14],
    popupAnchor: [0, -16],
  })
}

function updateMarkers() {
  if (!clusterLayer || !impianti.value.length) return
  clusterLayer.clearLayers()
  Object.keys(markers).forEach(k => delete markers[k])

  impianti.value.forEach(imp => {
    if (!imp.lat || !imp.lng) return
    const marker = L.marker([imp.lat, imp.lng], { icon: makeIcon(imp) })
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

function onLogoError(bandiera, evt) {
  const domain = getBrand(bandiera)?.domain
  if (domain) {
    logoErrors.value = new Set([...logoErrors.value, domain])
  }
  evt.target.style.display = 'none'
}

function showLogo(bandiera) {
  const domain = getBrand(bandiera)?.domain
  if (!domain) return false
  return !logoErrors.value.has(domain)
}

function closePanel() {
  const prev = selectedId.value
  selectedId.value = null
  if (prev) refreshMarkerIcon(prev)
}

function panelDate(imp) {
  for (const m of selectedFamilyMembers.value) {
    const d = imp?.prezzi?.[m]?.data
    if (d) return d
  }
  return null
}

function familyStats(family) {
  const members = FUEL_FAMILIES[family] ?? [family]
  for (const m of members) {
    if (allStats.value[m]?.self) return allStats.value[m]
  }
  return null
}

// Percentuale posizione prezzo nella fascia min-max (per range bar)
function rangePct(val, min, max) {
  if (min == null || max == null || max === min) return 50
  return Math.round(((val - min) / (max - min)) * 100)
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

    <!-- ── Banner notifiche ─────────────────────────────────────────────── -->
    <div v-if="error" class="banner banner-error">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>{{ error }}</span>
      <button class="banner-btn" @click="load(true)">Riprova</button>
    </div>

    <div v-if="coordSource === 'lastRefuel' && !error" class="banner banner-info">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>Prezzi vicino all'ultimo rifornimento registrato</span>
    </div>

    <div v-if="hasGlobalPriceWarning && !error && impianti.length" class="banner banner-warning">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      <span>I prezzi disponibili non sono aggiornati a oggi e potrebbero non essere più validi.</span>
    </div>

    <!-- ── Top bar: meta + azioni ──────────────────────────────────────────── -->
    <div class="top-bar">
      <div class="top-meta">
        <span v-if="loading" class="spinner-sm"></span>
        <template v-if="!loading && aggiornato">
          <span class="meta-chip">{{ totale }} stazioni</span>
          <span class="meta-sep">·</span>
          <span class="meta-text">agg. {{ aggiornato }}</span>
        </template>
        <span v-else-if="loading" class="meta-text">Caricamento...</span>
        <span v-else-if="!loading && !aggiornato && !error" class="meta-text">Nessun dato</span>
      </div>
      <div class="top-actions">
        <button
          class="icon-btn"
          @click="locateMe"
          :disabled="locating"
          :class="{ active: userLat }"
          title="Vai alla mia posizione"
        >
          <span v-if="locating" class="spinner-sm" style="width:14px;height:14px"></span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>
        <button
          class="icon-btn"
          @click="load(true)"
          :disabled="loading"
          :class="{ spinning: loading }"
          title="Aggiorna dati"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Mappa ───────────────────────────────────────────────────────────── -->
    <div class="map-wrap">
      <div ref="mapContainer" class="map-container"></div>

      <!-- Loading overlay sulla mappa -->
      <Transition name="fade">
        <div v-if="loading" class="map-loading-overlay">
          <div class="map-loading-pill">
            <span class="spinner-sm"></span>
            Caricamento prezzi…
          </div>
        </div>
      </Transition>

      <!-- Selettore carburante sovrapposto -->
      <div class="fuel-selector-overlay">
        <button
          v-for="f in carburanti" :key="f"
          class="fuel-chip" :class="{ active: selectedFuel === f }"
          @click="switchFuel(f)"
        >
          <span class="fuel-chip-icon">{{ FUEL_ICONS[f] ?? '⛽' }}</span>
          {{ f }}
        </button>
      </div>

      <!-- Legenda -->
      <div class="map-legend">
        <span class="leg-item"><span class="leg-dot" style="background:#16a34a"></span>Conveniente</span>
        <span class="leg-item"><span class="leg-dot" style="background:#d97706"></span>Media</span>
        <span class="leg-item"><span class="leg-dot" style="background:#dc2626"></span>Caro</span>
      </div>
    </div>

    <!-- ── Pannello dettaglio stazione ────────────────────────────────────── -->
    <Transition name="slide-up">
      <div v-if="selectedImp" class="detail-panel">

        <!-- Header -->
        <div class="panel-header">
          <!-- Logo o badge brand -->
          <div class="panel-brand-badge" :style="{ background: brandColor(selectedImp.bandiera) }">
            <img
              v-if="brandLogoUrl(selectedImp.bandiera) && showLogo(selectedImp.bandiera)"
              :src="brandLogoUrl(selectedImp.bandiera)"
              :alt="selectedImp.bandiera"
              class="panel-brand-logo"
              @error="onLogoError(selectedImp.bandiera, $event)"
            />
            <span v-else class="panel-brand-initial">{{ brandShort(selectedImp.bandiera) }}</span>
          </div>
          <div class="panel-title-group">
            <div class="panel-name">{{ selectedImp.nome }}</div>
            <div class="panel-brand">{{ selectedImp.bandiera }}</div>
          </div>
          <div class="panel-header-actions">
            <button class="maps-btn" @click="openMaps(selectedImp)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Naviga
            </button>
            <button class="panel-close" @click="closePanel" title="Chiudi">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Prezzi -->
        <div class="panel-prices">
          <template v-for="carb in selectedFamilyMembers" :key="carb">
            <template v-if="selectedImp.prezzi?.[carb]">

              <!-- Self-service -->
              <div v-if="selectedImp.prezzi[carb].self != null" class="price-card price-card-self">
                <div class="price-card-header">
                  <span class="price-label">{{ carb }}</span>
                  <span class="price-mode-badge">self</span>
                </div>
                <div class="price-main" :style="{ color: prezzoColore(selectedImp.prezzi[carb].self) }">
                  {{ fmt(selectedImp.prezzi[carb].self) }}
                  <span class="price-unit">€/L</span>
                </div>
                <!-- Confronto vs media -->
                <div
                  v-if="diffVsMedia(selectedImp.prezzi[carb].self) != null"
                  class="price-diff"
                  :class="{
                    'diff-good': diffVsMedia(selectedImp.prezzi[carb].self) < -0.005,
                    'diff-bad':  diffVsMedia(selectedImp.prezzi[carb].self) > 0.005,
                    'diff-mid':  Math.abs(diffVsMedia(selectedImp.prezzi[carb].self)) <= 0.005
                  }"
                >
                  {{ fmtDiff(diffVsMedia(selectedImp.prezzi[carb].self)) }} vs media
                </div>
              </div>

              <!-- Servito -->
              <div v-if="selectedImp.prezzi[carb].servito != null" class="price-card price-card-servito">
                <div class="price-card-header">
                  <span class="price-label">{{ carb }}</span>
                  <span class="price-mode-badge price-mode-servito">servito</span>
                </div>
                <div class="price-main price-main-sm">
                  {{ fmt(selectedImp.prezzi[carb].servito) }}
                  <span class="price-unit">€/L</span>
                </div>
              </div>

            </template>
          </template>
        </div>

        <!-- Meta: data aggiornamento -->
        <div class="panel-meta">
          <template v-if="selectedImp.prezzi?.[selectedFuel]?.data">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:12px;height:12px;flex-shrink:0">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Aggiornato: {{ selectedImp.prezzi[selectedFuel].data }}
            <span
              v-if="!isPriceToday(selectedImp.prezzi[selectedFuel].data)"
              class="price-outdated-badge"
            >Non aggiornato</span>
          </template>
        </div>
      </div>
    </Transition>

    <!-- ── Stats prezzi area ───────────────────────────────────────────────── -->
    <div class="stats-section" v-if="carburanti.length && !loading">
      <div class="stats-header">
        <span class="stats-title">Prezzi zona · self-service</span>
        <span class="stats-badge">{{ totale }} stazioni</span>
      </div>

      <div class="stats-list">
        <div
          v-for="family in carburanti" :key="family"
          class="stats-row"
          :class="{ 'stats-row-active': family === selectedFuel }"
          @click="switchFuel(family)"
          v-if="familyStats(family)"
        >
          <!-- Nome carburante -->
          <div class="sri-name">
            <span class="sri-icon">{{ FUEL_ICONS[family] ?? '⛽' }}</span>
            {{ family }}
          </div>

          <!-- Range prezzi con barra visiva -->
          <div class="sri-range-wrap">
            <div class="sri-prices-row">
              <span class="sri-min">{{ fmt(familyStats(family).self.min) }}</span>
              <div class="sri-range-bar">
                <div class="sri-range-fill"></div>
                <div
                  class="sri-range-dot sri-dot-media"
                  :style="{ left: rangePct(familyStats(family).self.media, familyStats(family).self.min, familyStats(family).self.max) + '%' }"
                ></div>
              </div>
              <span class="sri-max">{{ fmt(familyStats(family).self.max) }}</span>
            </div>
            <div class="sri-media-label">
              media <strong>{{ fmt(familyStats(family).self.media) }}</strong> €/L
            </div>
          </div>

          <!-- Conteggio -->
          <div class="sri-count">{{ familyStats(family).self.count }}</div>
        </div>
      </div>

      <div class="stats-footer">Fonte: MIMIT · Osservatorio Carburanti</div>
    </div>

    <!-- Empty state: nessun dato e nessun errore -->
    <div v-if="!loading && !error && !impianti.length && data" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p>Nessun distributore trovato nell'area.</p>
      <button class="empty-retry" @click="load(true)">Riprova</button>
    </div>

    </template><!-- /v-if="!isGuest" -->
  </div>
</template>

<style scoped>
.prices-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 28px;
}

/* ── Banner notifiche ─────────────────────────────────────────────────────── */
.banner {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  line-height: 1.4;
}
.banner svg { width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; }
.banner span { flex: 1; }
.banner-error  { background: rgba(239,68,68,0.09); border: 1px solid rgba(239,68,68,0.25); color: #b91c1c; }
.banner-error svg { color: #ef4444; }
.banner-warning { background: rgba(234,179,8,0.09); border: 1px solid rgba(234,179,8,0.3); color: #92400e; }
.banner-warning svg { color: #d97706; }
.banner-info   { background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.22); color: var(--text-secondary); }
.banner-info svg { color: var(--primary); }
.banner-btn {
  flex-shrink: 0;
  padding: 4px 11px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  align-self: center;
}

/* ── Top bar ──────────────────────────────────────────────────────────────── */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
}
.top-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.meta-chip {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2px 9px;
}
.meta-sep  { font-size: 11px; color: var(--text-secondary); opacity: 0.5; }
.meta-text { font-size: 11px; color: var(--text-secondary); }

.top-actions { display: flex; gap: 6px; }
.icon-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 