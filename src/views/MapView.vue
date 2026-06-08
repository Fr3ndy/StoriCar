<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useAuth } from '../composables/useAuth'
import AuthWall from '../components/AuthWall.vue'
import L from 'leaflet'

const router = useRouter()
const { isGuest } = useAuth()
const { data, selectedVehicleId, getVehicle } = useStorage()

const mapContainer = ref(null)
let map = null
let markersLayer = null

const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)

const fuelRecordsWithLocation = computed(() => {
  if (!selectedVehicleId.value) return []
  return data.value.fuelRecords
    .filter(r => r.vehicleId === selectedVehicleId.value && r.location)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

onMounted(() => {
  nextTick(() => {
    initMap()
  })
})

// ricalcola i marker quando cambia il veicolo selezionato globalmente
watch(selectedVehicleId, () => { updateMarkers() })

function initMap() {
  if (!mapContainer.value) return

  // Default center (Italy)
  map = L.map(mapContainer.value).setView([41.9028, 12.4964], 6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)

  updateMarkers()
}

const markerRefs = {}

function updateMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()
  Object.keys(markerRefs).forEach(k => delete markerRefs[k])

  const records = fuelRecordsWithLocation.value
  if (records.length === 0) return

  const bounds = []

  records.forEach((record, index) => {
    const { lat, lng } = record.location

    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin"><span>${index + 1}</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -34]
    })

    const marker = L.marker([lat, lng], { icon })

    const date = new Date(record.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    const fmtEur = (n) => n != null ? n.toFixed(2).replace('.', ',') + ' €' : '—'
    const fmtL   = (n) => n != null ? n.toFixed(2).replace('.', ',') + ' L' : '—'
    const fmtPpl = (n) => n != null ? n.toFixed(3).replace('.', ',') + ' €/L' : '—'

    const popupContent = `
      <div class="map-popup">
        <div class="map-popup-date">${date}</div>
        <div class="map-popup-row"><span>${fmtEur(record.amount)}</span><span>${fmtL(record.liters)}</span><span>${fmtPpl(record.pricePerLiter)}</span></div>
        ${record.address ? `<div class="map-popup-addr">${record.address}</div>` : ''}
      </div>
    `

    marker.bindPopup(popupContent)
    marker.addTo(markersLayer)
    markerRefs[record.id] = marker

    bounds.push([lat, lng])
  })

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] })
  }
}

function panToRecord(record) {
  const { lat, lng } = record.location
  map.setView([lat, lng], 15, { animate: true })
  const m = markerRefs[record.id]
  if (m) m.openPopup()
}

watch(selectedVehicleId, () => {
  updateMarkers()
})

function formatNumber(num, decimals = 2) {
  if (num == null) return '-'
  return num.toFixed(decimals).replace('.', ',')
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT')
}
</script>

<template>
  <div class="map-view">
    <!-- Auth wall per ospiti -->
    <AuthWall
      v-if="isGuest"
      title="Mappa rifornimenti"
      description="Visualizza sulla mappa tutti i tuoi rifornimenti e traccia i percorsi. Richiede un account."
      feature-name="la mappa dei rifornimenti"
      icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />

    <template v-if="!isGuest">
    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary" style="margin-top:16px" @click="router.push('/vehicles')">
        Aggiungi Veicolo
      </button>
    </div>

    <div v-else>
      <!-- Map -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- Location list -->
      <div v-if="fuelRecordsWithLocation.length === 0" class="card empty-map">
        <p>Nessun rifornimento con posizione</p>
        <small>Usa "Rileva posizione" quando aggiungi un rifornimento</small>
      </div>

      <div v-else class="card fuel-list-card">
        <div class="fuel-list-header">
          <span class="card-title">Rifornimenti</span>
          <span class="fuel-list-count">{{ fuelRecordsWithLocation.length }}</span>
        </div>
        <div
          v-for="(record, index) in fuelRecordsWithLocation"
          :key="record.id"
          class="fuel-list-row"
          @click="panToRecord(record)"
        >
          <div class="fl-num">{{ index + 1 }}</div>
          <div class="fl-info">
            <div class="fl-main">{{ formatDate(record.date) }} · {{ formatNumber(record.amount) }} €</div>
            <div class="fl-sub">{{ formatNumber(record.liters) }} L · {{ formatNumber(record.pricePerLiter, 3) }} €/L
              <span v-if="record.address"> · {{ record.address }}</span>
            </div>
          </div>
          <svg class="fl-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
    </template><!-- /v-if="!isGuest" -->
  </div>
</template>

<style>
/* Leaflet marker — global so Leaflet can apply it */
.custom-marker { background: transparent; border: none; }

.marker-pin {
  width: 32px; height: 32px;
  background: #111;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}
.marker-pin span {
  transform: rotate(45deg);
  color: #fff; font-weight: 700; font-size: 11px;
}

.map-popup { font-size: 13px; line-height: 1.5; min-width: 160px; }
.map-popup-date  { font-weight: 700; margin-bottom: 4px; }
.map-popup-row   { display: flex; gap: 8px; color: #444; flex-wrap: wrap; }
.map-popup-addr  { margin-top: 5px; font-size: 11px; color: #666; }

/* Leaflet popup overrides */
.leaflet-popup-content-wrapper { border-radius: 10px !important; }
.leaflet-popup-tip-container { display: none; }
</style>

<style scoped>
.map-container {
  height: 360px;
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--border);
  z-index: 1;
  margin-bottom: 12px;
}

.empty-map {
  text-align: center; padding: 24px 16px; color: var(--text-secondary); font-size: 14px;
}
.empty-map small { display: block; margin-top: 6px; font-size: 12px; color: var(--text-tertiary); }

.fuel-list-card { padding: 0; overflow: hidden; margin-bottom: 24px; }

.fuel-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
.fuel-list-count {
  font-size: 12px; font-weight: 700;
  background: var(--bg-secondary); color: var(--text-secondary);
  border: 1px solid var(--border); border-radius: 20px;
  padding: 2px 8px;
}

.fuel-list-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px; border-bottom: 1px solid var(--border);
  cursor: pointer; transition: background .12s;
}
.fuel-list-row:last-child { border-bottom: none; }
.fuel-list-row:active { background: var(--bg-secondary); }

.fl-num {
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--text-primary); color: var(--bg-card);
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.fl-info { flex: 1; min-width: 0; }
.fl-main { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.fl-sub  {
  font-size: 11px; color: var(--text-secondary); margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.fl-arrow { width: 14px; height: 14px; color: var(--text-tertiary); flex-shrink: 0; }
</style>
