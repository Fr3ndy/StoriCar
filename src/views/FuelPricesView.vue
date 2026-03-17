<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import { useStorage } from '../composables/useStorage'

const { getSetting } = useStorage()

// ── Stato ─────────────────────────────────────────────────────────────────────
const loading      = ref(false)
const error        = ref(null)
const data         = ref(null)
const userLat      = ref(null)
const userLng      = ref(null)
const locating     = ref(false)
const selectedId   = ref(null)
const selectedFuel = ref('Benzina')

// Impostazioni area mappa
function getMapParams() {
  const lat = getSetting('fuelMapLat')
  const lng = getSetting('fuelMapLng')
  const km  = getSetting('fuelMapRadius') ?? 10
  return { lat, lng, km }
}

// Mappa
const mapContainer = ref(null)
let map            = null
let markersLayer   = null
let userMarker     = null
const markers      = {}

// ── API ───────────────────────────────────────────────────────────────────────
async function load(refresh = false) {
  loading.value = true
  error.value   = null
  try {
    const base = import.meta.env.VITE_FUEL_PRICES_URL || './fuel-prices.php'
    const { lat, lng, km } = getMapParams()
    const params = new URLSearchParams()
    if (lat != null) params.set('lat', lat)
    if (lng != null) params.set('lng', lng)
    params.set('km', km)
    if (refresh) params.set('refresh', '1')
    const url = `${base}?${params}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
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

// ── Computed ──────────────────────────────────────────────────────────────────
const impianti   = computed(() => data.value?.impianti ?? [])
const allStats   = computed(() => data.value?.stats ?? {})
const aggiornato = computed(() => data.value?.aggiornato ?? null)
const totale     = computed(() => data.value?.totale ?? 0)
const carburanti = computed(() => data.value?.carburanti ?? ['Benzina', 'Gasolio'])

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
  return imp.prezzi?.[selectedFuel.value]?.self ?? null
}

function prezzoColore(selfVal) {
  if (selfVal == null || mediaself.value == null) return '#64748b'
  if (selfVal <= mediaself.value - 0.02) return '#16a34a'
  if (selfVal >= mediaself.value + 0.02) return '#dc2626'
  return '#d97706'
}

function prezzoLabel(imp) {
  const p = imp.prezzi?.[selectedFuel.value]
  if (!p) return '?'
  if (p.self != null) return fmt(p.self)
  if (p.servito != null) return fmt(p.servito)
  return '?'
}

function switchFuel(fuel) {
  selectedFuel.value = fuel
  selectedId.value = null
  nextTick(() => updateMarkers())
}

// ── GPS ───────────────────────────────────────────────────────────────────────
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
  const { lat, lng } = getMapParams()
  const center = (lat != null && lng != null) ? [lat, lng] : [39.27, 9.09]
  map = L.map(mapContainer.value, { zoomControl: true }).setView(center, 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  markersLayer = L.layerGroup().addTo(map)
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
  if (!markersLayer || !impianti.value.length) return
  markersLayer.clearLayers()
  Object.keys(markers).forEach(k => delete markers[k])

  impianti.value.forEach(imp => {
    if (!imp.lat || !imp.lng) return
    const marker = L.marker([imp.lat, imp.lng], { icon: makeIcon(imp) })
    marker.on('click', () => selectImp(imp.id))
    marker.addTo(markersLayer)
    markers[imp.id] = marker
  })
}

function refreshMarkerIcon(id) {
  const imp = impianti.value.find(i => i.id === id)
  if (imp && markers[id]) markers[id].setIcon(makeIcon(imp))
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

watch(selectedId, (newId, oldId) => {
  if (oldId) refreshMarkerIcon(oldId)
  if (newId) refreshMarkerIcon(newId)
})
</script>

<template>
  <div class="prices-view">

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

    <!-- Errore -->
    <div v-if="error" class="error-banner">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      {{ error }}
      <button @click="load(true)">Riprova</button>
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
          <template v-for="(p, carb) in selectedImp.prezzi" :key="carb">
            <div v-if="p.self != null" class="panel-price-row" :class="{ 'is-selected-fuel': carb === selectedFuel }">
              <span class="panel-price-type">{{ carb }} <span class="price-mode">self</span></span>
              <span class="panel-price-val" :style="{ color: carb === selectedFuel ? prezzoColore(p.self) : 'var(--text-secondary)' }">{{ fmt(p.self) }} €/L</span>
            </div>
            <div v-if="p.servito != null" class="panel-price-row panel-price-row-sm">
              <span class="panel-price-type">{{ carb }} <span class="price-mode">servito</span></span>
              <span class="panel-price-val" style="color:var(--text-secondary)">{{ fmt(p.servito) }} €/L</span>
            </div>
          </template>
        </div>
        <div class="panel-meta" v-if="selectedImp.prezzi?.[selectedFuel]?.data">
          Agg. {{ selectedImp.prezzi[selectedFuel].data }}
        </div>
      </div>
    </Transition>


    <!-- Stats tutti i carburanti: in fondo -->
    <div class="stats-section" v-if="Object.keys(allStats).length">
      <div class="stats-title">Prezzi area · self-service</div>
      <div class="stats-grid">
        <template v-for="(s, fuel) in allStats" :key="fuel">
          <div v-if="s && s.self" class="stats-card">
            <div class="stats-card-header">{{ fuel }}</div>
            <div class="stats-row">
              <div class="stats-item">
                <div class="stats-val stats-min">{{ fmt(s.self.min) }}</div>
                <div class="stats-lbl">min</div>
              </div>
              <div class="stats-item stats-item-mid">
                <div class="stats-val">{{ fmt(s.self.media) }}</div>
                <div class="stats-lbl">media</div>
              </div>
              <div class="stats-item">
                <div class="stats-val stats-max">{{ fmt(s.self.max) }}</div>
                <div class="stats-lbl">max</div>
              </div>
            </div>
            <div class="stats-count">{{ s.self.count }} impianti</div>
          </div>
        </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
.prices-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 24px;
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
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
}

/* Selettore carburante sovrapposto: piccolo, in alto a sx */
.fuel-selector-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 500;
  display: flex;
  gap: 4px;
}
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


/* Stats in fondo */
.stats-section {
  margin-top: 4px;
}
.stats-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 0 2px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.stats-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 14px;
}
.stats-card-header {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.stats-row {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.stats-item {
  flex: 1;
  text-align: center;
}
.stats-item-mid {
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 0 4px;
}
.stats-val {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}
.stats-min { color: #16a34a; }
.stats-max { color: #dc2626; }
.stats-lbl {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-top: 2px;
}
.stats-count {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 6px;
  text-align: right;
}

/* Transizione pannello */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.2s cubic-bezier(0.32,0.72,0,1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }
</style>
