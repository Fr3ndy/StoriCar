<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import L from 'leaflet'

const router = useRouter()
const { data, getDefaultVehicleId, setDefaultVehicle, getVehicle } = useStorage()

const mapContainer = ref(null)
let map = null
let markersLayer = null

const selectedVehicleId = ref(null)

const vehicles = computed(() => data.value.vehicles)
const hasVehicles = computed(() => vehicles.value.length > 0)

const fuelRecordsWithLocation = computed(() => {
  if (!selectedVehicleId.value) return []
  return data.value.fuelRecords
    .filter(r => r.vehicleId === selectedVehicleId.value && r.location)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

onMounted(() => {
  const defaultId = getDefaultVehicleId()
  if (defaultId && vehicles.value.find(v => v.id === defaultId)) {
    selectedVehicleId.value = defaultId
  } else if (vehicles.value.length > 0) {
    selectedVehicleId.value = vehicles.value[0].id
  }

  nextTick(() => {
    initMap()
  })
})

function onVehicleChange(e) {
  selectedVehicleId.value = e.target.value
  setDefaultVehicle(e.target.value)
  updateMarkers()
}

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

function updateMarkers() {
  if (!markersLayer) return

  markersLayer.clearLayers()

  const records = fuelRecordsWithLocation.value

  if (records.length === 0) return

  const bounds = []

  records.forEach((record, index) => {
    const { lat, lng } = record.location

    // Custom icon with number
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin">${index + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    })

    const marker = L.marker([lat, lng], { icon })

    // Popup content
    const date = new Date(record.date).toLocaleDateString('it-IT')
    const popupContent = `
      <div class="map-popup">
        <strong>${date}</strong><br>
        ${record.amount?.toFixed(2)} € - ${record.liters?.toFixed(2)} L<br>
        ${record.pricePerLiter?.toFixed(3)} €/L<br>
        ${record.address ? `<small>${record.address}</small>` : ''}
      </div>
    `

    marker.bindPopup(popupContent)
    marker.addTo(markersLayer)

    bounds.push([lat, lng])
  })

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] })
  }
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
    <!-- No vehicles -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      </svg>
      <h2>Nessun veicolo</h2>
      <p>Aggiungi prima un veicolo</p>
      <button class="btn btn-primary mt-16" @click="router.push('/vehicles')">
        Aggiungi Veicolo
      </button>
    </div>

    <div v-else>
      <!-- Vehicle selector -->
      <div class="vehicle-selector">
        <select class="form-select" :value="selectedVehicleId" @change="onVehicleChange">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">
            {{ v.name }} {{ v.plate ? `(${v.plate})` : '' }}
          </option>
        </select>
      </div>

      <!-- Map -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- Location list -->
      <div v-if="fuelRecordsWithLocation.length === 0" class="card mt-16">
        <div class="empty-state" style="padding: 20px;">
          <p>Nessun rifornimento con posizione registrata</p>
          <small>Quando registri un rifornimento, usa "Rileva posizione" per salvare dove hai fatto rifornimento</small>
        </div>
      </div>

      <div v-else class="card mt-16">
        <h3 class="card-title" style="margin-bottom: 12px;">Rifornimenti sulla mappa ({{ fuelRecordsWithLocation.length }})</h3>
        <div
          v-for="(record, index) in fuelRecordsWithLocation.slice(0, 5)"
          :key="record.id"
          class="list-item"
        >
          <div class="location-number">{{ index + 1 }}</div>
          <div class="list-item-content">
            <div class="list-item-title">{{ formatDate(record.date) }} - {{ formatNumber(record.amount) }} €</div>
            <div class="list-item-subtitle" v-if="record.address">{{ record.address }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Leaflet marker styles */
.custom-marker {
  background: transparent;
  border: none;
}

.marker-pin {
  width: 30px;
  height: 30px;
  background: var(--primary, #3b82f6);
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.marker-pin::after {
  content: attr(data-number);
  transform: rotate(45deg);
}

.map-popup {
  font-size: 14px;
  line-height: 1.4;
}

.map-popup small {
  color: #666;
  display: block;
  margin-top: 4px;
}
</style>

<style scoped>
.map-container {
  height: 350px;
  border-radius: 12px;
  overflow: hidden;
  z-index: 1;
}

.location-number {
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  margin-right: 12px;
  flex-shrink: 0;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.list-item:last-child {
  border-bottom: none;
}
</style>
