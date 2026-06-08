<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '../composables/useStorage'
import { useStatistics } from '../composables/useStatistics'

const router = useRouter()
const { data, selectedVehicleId } = useStorage()
const stats = useStatistics(selectedVehicleId)

const hasVehicles = computed(() => data.value.vehicles.length > 0)

function fmt(n, d = 2) { return (n == null || isNaN(n)) ? '—' : n.toFixed(d).replace('.', ',') }
function fmtCur(n)     { return (n == null || isNaN(n)) ? '—' : '€ ' + fmt(n) }
</script>

<template>
  <div>

    <!-- ── Empty ── -->
    <div v-if="!hasVehicles" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
      </svg>
      <h2>Benvenuto in Storicar</h2>
      <p>Aggiungi il tuo primo veicolo per iniziare</p>
      <button class="btn btn-primary" style="margin-top:20px" @click="router.push('/vehicles')">Aggiungi veicolo</button>
    </div>

    <!-- ── Dashboard ── -->
    <div v-else class="dashboard">

      <!-- Vehicle card -->
      <div class="vehicle-card">
        <div class="vc-top">
          <div class="vc-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 9l1.5-4.5A2 2 0 016.4 3h11.2a2 2 0 011.9 1.5L21 9M3 9h18M3 9l-1 4h20l-1-4"/>
            </svg>
          </div>
          <div class="vc-info">
            <div class="vc-name">{{ stats.vehicle.value?.name || 'Veicolo' }}</div>
            <div class="vc-sub">
              {{ [stats.vehicle.value?.brand, stats.vehicle.value?.model].filter(Boolean).join(' ') }}
              <template v-if="stats.vehicle.value?.plate"> · <strong>{{ stats.vehicle.value.plate }}</strong></template>
            </div>
          </div>
          <div class="vc-odo">
            <span class="vc-odo-num">{{ stats.lastOdometer.value > 0 ? stats.lastOdometer.value.toLocaleString('it-IT') : '—' }}</span>
            <span class="vc-odo-unit">km</span>
          </div>
        </div>
        <!-- Consumption stats -->
        <div v-if="stats.formattedConsumption.value.value || stats.fuelRecords.value[0]?.computerConsumption" class="vc-cons-row">
          <div class="vc-cons-item">
            <span class="vc-cons-label">Consumo reale</span>
            <span class="vc-cons-val">{{ fmt(stats.formattedConsumption.value.value) }} <span>{{ stats.formattedConsumption.value.unit }}</span></span>
          </div>
          <div v-if="stats.fuelRecords.value[0]?.computerConsumption" class="vc-cons-item">
            <span class="vc-cons-label">Computer</span>
            <span class="vc-cons-val">{{ fmt(stats.fuelRecords.value[0].computerConsumption, 1) }} <span>{{ (data.value?.settings?.consumptionUnit || 'kmL') === 'L100km' ? 'L/100km' : 'km/L' }}</span></span>
          </div>
          <div class="vc-cons-item">
            <span class="vc-cons-label">Costo/km</span>
            <span class="vc-cons-val">{{ fmt(stats.costPerKm.value, 3) }} <span>€/km</span></span>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="actions-grid">
        <button class="action-tile primary" @click="router.push('/fuel/add')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <span>Rifornimento</span>
        </button>
        <button class="action-tile" @click="router.push('/expenses/add')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <span>Spesa</span>
        </button>
        <button class="action-tile" @click="router.push('/actions/add')">
          <div class="action-tile-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <span>Azione</span>
        </button>
      </div>

      <!-- Ultimi rifornimenti -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">Ultimi rifornimenti</span>
          <button class="section-link" @click="router.push('/fuel')">Vedi tutti</button>
        </div>
        <div v-if="stats.fuelRecords.value.length === 0" class="card" style="text-align:center;color:var(--text-secondary);font-size:14px;padding:20px">
          Nessun rifornimento registrato
        </div>
        <div v-else class="card" style="padding:0;overflow:hidden">
          <div
            v-for="(r, i) in stats.fuelRecords.value.slice(0, 3)"
            :key="r.id"
            class="fuel-row"
            :class="{ 'fuel-row-last': i === Math.min(stats.fuelRecords.value.length, 3) - 1 }"
            @click="router.push(`/fuel/edit/${r.id}`)"
          >
            <div class="fuel-date-box">
              <span class="fuel-day">{{ new Date(r.date).getDate().toString().padStart(2,'0') }}</span>
              <span class="fuel-month">{{ new Date(r.date).toLocaleDateString('it-IT', { month:'short' }) }}</span>
            </div>
            <div class="fuel-info">
              <div class="fuel-main">{{ fmtCur(r.amount) }}</div>
              <div class="fuel-sub">{{ fmt(r.liters) }} L · {{ fmt(r.pricePerLiter, 3) }} €/L<span v-if="r.kmDriven"> · {{ Math.round(r.kmDriven) }} km</span></div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="fuel-chevron">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; }

.vehicle-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 16px;
  margin-bottom: 10px; box-shadow: var(--shadow-sm);
}

.vc-top { display: flex; align-items: center; gap: 12px; }

.vc-icon {
  width: 38px; height: 38px; border-radius: var(--r);
  background: var(--bg-secondary); color: var(--text-primary);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.vc-icon svg { width: 20px; height: 20px; }

.vc-info  { flex: 1; min-width: 0; }
.vc-name  { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.vc-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 1px; }
.vc-sub strong { font-weight: 700; color: var(--text-primary); }

.vc-odo  { text-align: right; flex-shrink: 0; }
.vc-odo-num { font-size: 28px; font-weight: 900; color: var(--text-primary); letter-spacing: -1.5px; line-height: 1; display: block; }
.vc-odo-unit { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

.vc-cons-row {
  display: flex; gap: 0; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--border);
}
.vc-cons-item { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.vc-cons-item + .vc-cons-item { border-left: 1px solid var(--border); padding-left: 12px; }
.vc-cons-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; color: var(--text-tertiary); }
.vc-cons-val   { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.vc-cons-val span { font-size: 10px; font-weight: 500; color: var(--text-secondary); }

/* ── Quick actions ── */
.actions-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.action-tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 7px; padding: 14px 8px; border-radius: var(--r-md);
  border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text-secondary); font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all .15s; box-shadow: var(--shadow-sm);
}
.action-tile:active { transform: scale(.96); opacity: .85; }
.action-tile-icon {
  width: 34px; height: 34px; border-radius: var(--r);
  background: var(--bg-secondary);
  display: flex; align-items: center; justify-content: center;
}
.action-tile-icon svg { width: 17px; height: 17px; }
.action-tile.primary {
  background: var(--text-primary); color: var(--bg-card);
  border-color: transparent; box-shadow: 0 3px 12px rgba(0,0,0,.18);
}
.action-tile.primary .action-tile-icon { background: rgba(255,255,255,0.15); }
[data-theme="dark"] .action-tile.primary .action-tile-icon { background: rgba(0,0,0,0.15); }

/* ── Section ── */
.section { margin-bottom: 10px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 0 2px; }
.section-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.section-link  { font-size: 12px; color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; }

/* ── Fuel rows ── */
.fuel-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .12s; }
.fuel-row:active { background: var(--bg-secondary); }
.fuel-row-last { border-bottom: none; }
.fuel-date-box { width: 36px; height: 42px; background: var(--bg-secondary); border-radius: var(--r); border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
.fuel-day   { font-size: 15px; font-weight: 800; color: var(--text-primary); line-height: 1; }
.fuel-month { font-size: 9px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 1px; }
.fuel-info  { flex: 1; min-width: 0; }
.fuel-main  { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.fuel-sub   { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.fuel-chevron { width: 14px; height: 14px; color: var(--text-tertiary); flex-shrink: 0; }
</style>
