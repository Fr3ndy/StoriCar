import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// ── Struttura dati di default ────────────────────────────────
const defaultSettings = {
  theme: 'light',
  defaultVehicleId: null,
  consumptionUnit: 'kmL',
  currency: 'EUR',
  language: 'it',
  distanceUnit: 'km',
  volumeUnit: 'L',
  dateFormat: 'DD/MM/YYYY',
  defaultFuelType: '',
  showOdometer: true,
  showRemainingRange: true,
  notifyDeadlinesDays: 30,
  appName: 'Storicar',
  fuelMapLat: null,
  fuelMapLng: null,
  fuelMapRadius: 10,
  username: '',
}

const emptyData = () => ({
  vehicles: [],
  fuelRecords: [],
  expenses: [],
  deadlines: [],
  recurringPayments: [],
  settings: { ...defaultSettings }
})

// Stato singleton
const data         = ref(emptyData())
const dataReady    = ref(false)
let   loadingPromise = null

// ── Helpers localStorage (guest mode) ────────────────────────
const LOCAL_DATA_KEY = 'storicar_local_data'

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw)
    parsed.settings = { ...defaultSettings, ...parsed.settings }
    return parsed
  } catch {
    return emptyData()
  }
}

function saveLocalData() {
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data.value))
}

function clearLocalData() {
  localStorage.removeItem(LOCAL_DATA_KEY)
}

function localId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// ── Mapper DB → JS ───────────────────────────────────────────
function mapVehicle(r) {
  return {
    id: r.id, name: r.name, vehicleType: r.vehicle_type, plate: r.plate,
    brand: r.brand, model: r.model, year: r.year, fuelType: r.fuel_type,
    initialOdometer: r.initial_odometer
  }
}
function mapFuelRecord(r) {
  return {
    id: r.id, vehicleId: r.vehicle_id, date: r.date, amount: r.amount,
    liters: r.liters, pricePerLiter: r.price_per_liter, kmDriven: r.km_driven,
    odometer: r.odometer, remainingRange: r.remaining_range, notes: r.notes,
    location: r.location ? JSON.parse(r.location) : null, address: r.address
  }
}
function mapExpense(r) {
  return {
    id: r.id, vehicleId: r.vehicle_id, date: r.date, category: r.category,
    amount: r.amount, description: r.description, notes: r.notes
  }
}
function mapDeadline(r) {
  return {
    id: r.id, vehicleId: r.vehicle_id, type: r.type, description: r.description,
    expiryDate: r.expiry_date, amount: r.amount, reminderDays: r.reminder_days,
    notes: r.notes
  }
}
function mapRecurringPayment(r) {
  return {
    id: r.id, vehicleId: r.vehicle_id, name: r.name, amount: r.amount,
    frequency: r.frequency, startDate: r.start_date, nextDate: r.next_date,
    category: r.category, notes: r.notes
  }
}
function mapSettings(r) {
  if (!r) return { ...defaultSettings }
  return {
    theme:               r.theme                ?? defaultSettings.theme,
    defaultVehicleId:    r.default_vehicle_id   ?? null,
    consumptionUnit:     r.consumption_unit      ?? defaultSettings.consumptionUnit,
    currency:            r.currency             ?? defaultSettings.currency,
    language:            r.language             ?? defaultSettings.language,
    distanceUnit:        r.distance_unit        ?? defaultSettings.distanceUnit,
    volumeUnit:          r.volume_unit          ?? defaultSettings.volumeUnit,
    dateFormat:          r.date_format          ?? defaultSettings.dateFormat,
    defaultFuelType:     r.default_fuel_type    ?? defaultSettings.defaultFuelType,
    showOdometer:        r.show_odometer        ?? defaultSettings.showOdometer,
    showRemainingRange:  r.show_remaining_range ?? defaultSettings.showRemainingRange,
    notifyDeadlinesDays: r.notify_deadlines_days ?? defaultSettings.notifyDeadlinesDays,
    appName:             r.app_name             ?? defaultSettings.appName,
    fuelMapLat:          r.fuel_map_lat         ?? null,
    fuelMapLng:          r.fuel_map_lng         ?? null,
    fuelMapRadius:       r.fuel_map_radius      ?? defaultSettings.fuelMapRadius,
    username:            r.username             ?? '',
  }
}

// ── Caricamento dati da Supabase ─────────────────────────────
async function loadData() {
  console.log('[useStorage] loadData chiamato, loadingPromise:', !!loadingPromise)
  if (loadingPromise) return loadingPromise
  dataReady.value = false
  loadingPromise = (async () => {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT 10s')), 10000))
      const fetches = Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: true }),
        supabase.from('fuel_records').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('deadlines').select('*').order('expiry_date', { ascending: true }),
        supabase.from('recurring_payments').select('*'),
        supabase.from('user_settings').select('*').maybeSingle()
      ])
      const [
        { data: vehicles, error: e1 },
        { data: fuelRecords, error: e2 },
        { data: expenses, error: e3 },
        { data: deadlines, error: e4 },
        { data: recurringPayments, error: e5 },
        { data: settingsRow, error: e6 }
      ] = await Promise.race([fetches, timeout])
      console.log('[useStorage] errori fetch:', { e1, e2, e3, e4, e5, e6 })
      data.value = {
        vehicles:          (vehicles          || []).map(mapVehicle),
        fuelRecords:       (fuelRecords       || []).map(mapFuelRecord),
        expenses:          (expenses          || []).map(mapExpense),
        deadlines:         (deadlines         || []).map(mapDeadline),
        recurringPayments: (recurringPayments || []).map(mapRecurringPayment),
        settings:          mapSettings(settingsRow)
      }
    } catch (e) {
      console.error('[useStorage] loadData error:', e)
    } finally {
      dataReady.value = true
      loadingPromise  = null
    }
  })()
  return loadingPromise
}

// ── Migrazione dati ospite → Supabase ────────────────────────
async function migrateGuestData(userId) {
  const guestData = loadLocalData()
  const hasData   = guestData.vehicles.length > 0 || guestData.fuelRecords.length > 0

  if (!hasData) {
    clearLocalData()
    await loadData()
    return
  }

  console.log('[useStorage] migrazione dati ospite in corso...')
  dataReady.value = false

  try {
    const vehicleIdMap = {}

    for (const v of guestData.vehicles) {
      const { data: row, error } = await supabase.from('vehicles').insert({
        user_id:          userId,
        name:             v.name,
        vehicle_type:     v.vehicleType,
        plate:            v.plate,
        brand:            v.brand,
        model:            v.model,
        year:             v.year,
        fuel_type:        v.fuelType,
        initial_odometer: v.initialOdometer || 0
      }).select().single()
      if (!error && row) vehicleIdMap[v.id] = row.id
    }

    for (const r of guestData.fuelRecords) {
      await supabase.from('fuel_records').insert({
        user_id:         userId,
        vehicle_id:      vehicleIdMap[r.vehicleId] || r.vehicleId,
        date:            r.date,
        amount:          r.amount,
        liters:          r.liters,
        price_per_liter: r.pricePerLiter,
        km_driven:       r.kmDriven,
        odometer:        r.odometer,
        remaining_range: r.remainingRange,
        notes:           r.notes,
        location:        r.location ? JSON.stringify(r.location) : null,
        address:         r.address
      })
    }

    for (const e of guestData.expenses) {
      await supabase.from('expenses').insert({
        user_id:     userId,
        vehicle_id:  vehicleIdMap[e.vehicleId] || e.vehicleId,
        date:        e.date,
        category:    e.category,
        amount:      e.amount,
        description: e.description,
        notes:       e.notes
      })
    }

    for (const d of guestData.deadlines) {
      await supabase.from('deadlines').insert({
        user_id:       userId,
        vehicle_id:    vehicleIdMap[d.vehicleId] || d.vehicleId,
        type:          d.type,
        description:   d.description,
        expiry_date:   d.expiryDate,
        amount:        d.amount,
        reminder_days: d.reminderDays,
        notes:         d.notes
      })
    }

    for (const p of guestData.recurringPayments) {
      await supabase.from('recurring_payments').insert({
        user_id:    userId,
        vehicle_id: vehicleIdMap[p.vehicleId] || null,
        name:       p.name,
        amount:     p.amount,
        frequency:  p.frequency,
        start_date: p.startDate,
        next_date:  p.nextDate,
        category:   p.category,
        notes:      p.notes
      })
    }

    console.log('[useStorage] migrazione completata')
  } catch (e) {
    console.error('[useStorage] errore migrazione:', e)
  } finally {
    clearLocalData()
    loadingPromise = null
    await loadData()
  }
}

// ── Inizializzazione ─────────────────────────────────────────
supabase.auth.getSession().then(({ data: { session } }) => {
  console.log('[useStorage] getSession -', session?.user?.email ?? 'nessuna sessione')
  if (session?.user) {
    loadData()
  } else if (localStorage.getItem('storicar_guest') === '1') {
    data.value      = loadLocalData()
    dataReady.value = true
  } else {
    dataReady.value = true
  }
})

supabase.auth.onAuthStateChange(async (_event, session) => {
  console.log('[useStorage] onAuthStateChange - evento:', _event, '| utente:', session?.user?.email ?? 'null')

  if (_event === 'SIGNED_OUT') {
    data.value      = emptyData()
    dataReady.value = false
    loadingPromise  = null
    return
  }

  if (session?.user && (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN')) {
    const hasGuestData = !!localStorage.getItem(LOCAL_DATA_KEY)
    if (hasGuestData) {
      loadingPromise = null
      await migrateGuestData(session.user.id)
    } else if (!dataReady.value) {
      loadingPromise = null
      await loadData()
    }
  }
})

// ── Persist settings (upsert) ────────────────────────────────
async function persistSettings(s) {
  const { user, isGuest } = useAuth()
  if (isGuest.value) {
    saveLocalData()
    return
  }
  if (!user.value) return
  await supabase.from('user_settings').upsert({
    user_id:               user.value.id,
    theme:                 s.theme,
    default_vehicle_id:    s.defaultVehicleId || null,
    consumption_unit:      s.consumptionUnit,
    currency:              s.currency,
    language:              s.language,
    distance_unit:         s.distanceUnit,
    volume_unit:           s.volumeUnit,
    date_format:           s.dateFormat,
    default_fuel_type:     s.defaultFuelType,
    show_odometer:         s.showOdometer,
    show_remaining_range:  s.showRemainingRange,
    notify_deadlines_days: s.notifyDeadlinesDays,
    app_name:              s.appName,
    fuel_map_lat:          s.fuelMapLat  ?? null,
    fuel_map_lng:          s.fuelMapLng  ?? null,
    fuel_map_radius:       s.fuelMapRadius ?? 10,
    username:              s.username    ?? '',
  }, { onConflict: 'user_id' })
}

// ── Export composable ────────────────────────────────────────
export function useStorage() {
  const { user, isGuest } = useAuth()

  // ── Vehicles ─────────────────────────────────────────────────
  async function addVehicle(vehicle) {
    if (isGuest.value) {
      const id     = localId()
      const mapped = { ...vehicle, id, initialOdometer: vehicle.initialOdometer || 0 }
      data.value.vehicles.push(mapped)
      if (data.value.vehicles.length === 1) data.value.settings.defaultVehicleId = id
      saveLocalData()
      return id
    }
    const { data: row, error } = await supabase.from('vehicles')
      .insert({
        user_id:          user.value.id,
        name:             vehicle.name,
        vehicle_type:     vehicle.vehicleType,
        plate:            vehicle.plate,
        brand:            vehicle.brand,
        model:            vehicle.model,
        year:             vehicle.year,
        fuel_type:        vehicle.fuelType,
        initial_odometer: vehicle.initialOdometer || 0
      })
      .select().single()
    if (error) throw error
    const mapped = mapVehicle(row)
    data.value.vehicles.push(mapped)
    if (data.value.vehicles.length === 1) {
      data.value.settings.defaultVehicleId = mapped.id
      await persistSettings(data.value.settings)
    }
    return mapped.id
  }

  async function updateVehicle(id, updates) {
    if (isGuest.value) {
      const i = data.value.vehicles.findIndex(v => v.id === id)
      if (i !== -1) data.value.vehicles[i] = { ...data.value.vehicles[i], ...updates }
      saveLocalData()
      return
    }
    const db = {}
    if ('name'            in updates) db.name             = updates.name
    if ('vehicleType'     in updates) db.vehicle_type     = updates.vehicleType
    if ('plate'           in updates) db.plate            = updates.plate
    if ('brand'           in updates) db.brand            = updates.brand
    if ('model'           in updates) db.model            = updates.model
    if ('year'            in updates) db.year             = updates.year
    if ('fuelType'        in updates) db.fuel_type        = updates.fuelType
    if ('initialOdometer' in updates) db.initial_odometer = updates.initialOdometer
    const { error } = await supabase.from('vehicles').update(db).eq('id', id)
    if (error) throw error
    const i = data.value.vehicles.findIndex(v => v.id === id)
    if (i !== -1) data.value.vehicles[i] = { ...data.value.vehicles[i], ...updates }
  }

  async function deleteVehicle(id) {
    if (isGuest.value) {
      data.value.vehicles    = data.value.vehicles.filter(v => v.id !== id)
      data.value.fuelRecords = data.value.fuelRecords.filter(r => r.vehicleId !== id)
      data.value.expenses    = data.value.expenses.filter(e => e.vehicleId !== id)
      data.value.deadlines   = data.value.deadlines.filter(d => d.vehicleId !== id)
      if (data.value.settings.defaultVehicleId === id)
        data.value.settings.defaultVehicleId = data.value.vehicles[0]?.id || null
      saveLocalData()
      return
    }
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) throw error
    data.value.vehicles    = data.value.vehicles.filter(v => v.id !== id)
    data.value.fuelRecords = data.value.fuelRecords.filter(r => r.vehicleId !== id)
    data.value.expenses    = data.value.expenses.filter(e => e.vehicleId !== id)
    data.value.deadlines   = data.value.deadlines.filter(d => d.vehicleId !== id)
    if (data.value.settings.defaultVehicleId === id) {
      data.value.settings.defaultVehicleId = data.value.vehicles[0]?.id || null
      await persistSettings(data.value.settings)
    }
  }

  function getVehicle(id) { return data.value.vehicles.find(v => v.id === id) }

  // ── Fuel Records ─────────────────────────────────────────────
  async function addFuelRecord(record) {
    if (isGuest.value) {
      const mapped = { ...record, id: localId() }
      data.value.fuelRecords.unshift(mapped)
      saveLocalData()
      return mapped.id
    }
    const { data: row, error } = await supabase.from('fuel_records')
      .insert({
        user_id:         user.value.id,
        vehicle_id:      record.vehicleId,
        date:            record.date,
        amount:          record.amount,
        liters:          record.liters,
        price_per_liter: record.pricePerLiter,
        km_driven:       record.kmDriven,
        odometer:        record.odometer,
        remaining_range: record.remainingRange,
        notes:           record.notes,
        location:        record.location ? JSON.stringify(record.location) : null,
        address:         record.address
      })
      .select().single()
    if (error) throw error
    const mapped = mapFuelRecord(row)
    data.value.fuelRecords.unshift(mapped)
    return mapped.id
  }

  async function updateFuelRecord(id, updates) {
    if (isGuest.value) {
      const i = data.value.fuelRecords.findIndex(r => r.id === id)
      if (i !== -1) data.value.fuelRecords[i] = { ...data.value.fuelRecords[i], ...updates }
      saveLocalData()
      return
    }
    const db = {}
    if ('date'           in updates) db.date            = updates.date
    if ('amount'         in updates) db.amount          = updates.amount
    if ('liters'         in updates) db.liters          = updates.liters
    if ('pricePerLiter'  in updates) db.price_per_liter = updates.pricePerLiter
    if ('kmDriven'       in updates) db.km_driven       = updates.kmDriven
    if ('odometer'       in updates) db.odometer        = updates.odometer
    if ('remainingRange' in updates) db.remaining_range = updates.remainingRange
    if ('notes'          in updates) db.notes           = updates.notes
    if ('location'       in updates) db.location        = updates.location ? JSON.stringify(updates.location) : null
    if ('address'        in updates) db.address         = updates.address
    const { error } = await supabase.from('fuel_records').update(db).eq('id', id)
    if (error) throw error
    const i = data.value.fuelRecords.findIndex(r => r.id === id)
    if (i !== -1) data.value.fuelRecords[i] = { ...data.value.fuelRecords[i], ...updates }
  }

  async function deleteFuelRecord(id) {
    if (isGuest.value) {
      data.value.fuelRecords = data.value.fuelRecords.filter(r => r.id !== id)
      saveLocalData()
      return
    }
    const { error } = await supabase.from('fuel_records').delete().eq('id', id)
    if (error) throw error
    data.value.fuelRecords = data.value.fuelRecords.filter(r => r.id !== id)
  }

  function getFuelRecord(id)                  { return data.value.fuelRecords.find(r => r.id === id) }
  function getFuelRecordsByVehicle(vehicleId)  {
    return data.value.fuelRecords
      .filter(r => r.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }
  function getLastFuelRecord(vehicleId)        { return getFuelRecordsByVehicle(vehicleId)[0] || null }
  function getPrevFuelRecord(vehicleId, excludeId, currentOdometer) {
    const records = getFuelRecordsByVehicle(vehicleId)
      .filter(r => r.id !== excludeId && r.odometer != null)
      .sort((a, b) => b.odometer - a.odometer)
    return currentOdometer != null
      ? records.find(r => r.odometer < currentOdometer) || null
      : records[0] || null
  }

  // ── Expenses ─────────────────────────────────────────────────
  async function addExpense(expense) {
    if (isGuest.value) {
      const mapped = { ...expense, id: localId() }
      data.value.expenses.unshift(mapped)
      saveLocalData()
      return mapped.id
    }
    const { data: row, error } = await supabase.from('expenses')
      .insert({
        user_id:     user.value.id,
        vehicle_id:  expense.vehicleId,
        date:        expense.date,
        category:    expense.category,
        amount:      expense.amount,
        description: expense.description,
        notes:       expense.notes
      })
      .select().single()
    if (error) throw error
    const mapped = mapExpense(row)
    data.value.expenses.unshift(mapped)
    return mapped.id
  }

  async function updateExpense(id, updates) {
    if (isGuest.value) {
      const i = data.value.expenses.findIndex(e => e.id === id)
      if (i !== -1) data.value.expenses[i] = { ...data.value.expenses[i], ...updates }
      saveLocalData()
      return
    }
    const db = {}
    if ('date'        in updates) db.date        = updates.date
    if ('category'    in updates) db.category    = updates.category
    if ('amount'      in updates) db.amount      = updates.amount
    if ('description' in updates) db.description = updates.description
    if ('notes'       in updates) db.notes       = updates.notes
    const { error } = await supabase.from('expenses').update(db).eq('id', id)
    if (error) throw error
    const i = data.value.expenses.findIndex(e => e.id === id)
    if (i !== -1) data.value.expenses[i] = { ...data.value.expenses[i], ...updates }
  }

  async function deleteExpense(id) {
    if (isGuest.value) {
      data.value.expenses = data.value.expenses.filter(e => e.id !== id)
      saveLocalData()
      return
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
    data.value.expenses = data.value.expenses.filter(e => e.id !== id)
  }

  function getExpense(id)                  { return data.value.expenses.find(e => e.id === id) }
  function getExpensesByVehicle(vehicleId) {
    return data.value.expenses
      .filter(e => e.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  // ── Deadlines ─────────────────────────────────────────────────
  async function addDeadline(deadline) {
    if (isGuest.value) {
      const mapped = { ...deadline, id: localId() }
      data.value.deadlines.push(mapped)
      data.value.deadlines.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      saveLocalData()
      return mapped.id
    }
    const { data: row, error } = await supabase.from('deadlines')
      .insert({
        user_id:       user.value.id,
        vehicle_id:    deadline.vehicleId,
        type:          deadline.type,
        description:   deadline.description,
        expiry_date:   deadline.expiryDate,
        amount:        deadline.amount,
        reminder_days: deadline.reminderDays,
        notes:         deadline.notes
      })
      .select().single()
    if (error) throw error
    const mapped = mapDeadline(row)
    data.value.deadlines.push(mapped)
    data.value.deadlines.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    return mapped.id
  }

  async function updateDeadline(id, updates) {
    if (isGuest.value) {
      const i = data.value.deadlines.findIndex(d => d.id === id)
      if (i !== -1) data.value.deadlines[i] = { ...data.value.deadlines[i], ...updates }
      saveLocalData()
      return
    }
    const db = {}
    if ('type'         in updates) db.type          = updates.type
    if ('description'  in updates) db.description   = updates.description
    if ('expiryDate'   in updates) db.expiry_date   = updates.expiryDate
    if ('amount'       in updates) db.amount        = updates.amount
    if ('reminderDays' in updates) db.reminder_days = updates.reminderDays
    if ('notes'        in updates) db.notes         = updates.notes
    const { error } = await supabase.from('deadlines').update(db).eq('id', id)
    if (error) throw error
    const i = data.value.deadlines.findIndex(d => d.id === id)
    if (i !== -1) data.value.deadlines[i] = { ...data.value.deadlines[i], ...updates }
  }

  async function deleteDeadline(id) {
    if (isGuest.value) {
      data.value.deadlines = data.value.deadlines.filter(d => d.id !== id)
      saveLocalData()
      return
    }
    const { error } = await supabase.from('deadlines').delete().eq('id', id)
    if (error) throw error
    data.value.deadlines = data.value.deadlines.filter(d => d.id !== id)
  }

  function getDeadline(id)                  { return data.value.deadlines.find(d => d.id === id) }
  function getDeadlinesByVehicle(vehicleId) {
    return data.value.deadlines
      .filter(d => d.vehicleId === vehicleId)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
  }
  function getAllDeadlines() {
    return [...data.value.deadlines].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
  }

  // ── Recurring Payments ────────────────────────────────────────
  async function addRecurringPayment(payment) {
    if (isGuest.value) {
      const mapped = { ...payment, id: localId() }
      data.value.recurringPayments.push(mapped)
      saveLocalData()
      return mapped.id
    }
    const { data: row, error } = await supabase.from('recurring_payments')
      .insert({
        user_id:    user.value.id,
        vehicle_id: payment.vehicleId || null,
        name:       payment.name,
        amount:     payment.amount,
        frequency:  payment.frequency,
        start_date: payment.startDate,
        next_date:  payment.nextDate,
        category:   payment.category,
        notes:      payment.notes
      })
      .select().single()
    if (error) throw error
    const mapped = mapRecurringPayment(row)
    data.value.recurringPayments.push(mapped)
    return mapped.id
  }

  async function updateRecurringPayment(id, updates) {
    if (isGuest.value) {
      const i = data.value.recurringPayments.findIndex(p => p.id === id)
      if (i !== -1) data.value.recurringPayments[i] = { ...data.value.recurringPayments[i], ...updates }
      saveLocalData()
      return
    }
    const db = {}
    if ('name'      in updates) db.name       = updates.name
    if ('amount'    in updates) db.amount     = updates.amount
    if ('frequency' in updates) db.frequency  = updates.frequency
    if ('startDate' in updates) db.start_date = updates.startDate
    if ('nextDate'  in updates) db.next_date  = updates.nextDate
    if ('category'  in updates) db.category   = updates.category
    if ('notes'     in updates) db.notes      = updates.notes
    const { error } = await supabase.from('recurring_payments').update(db).eq('id', id)
    if (error) throw error
    const i = data.value.recurringPayments.findIndex(p => p.id === id)
    if (i !== -1) data.value.recurringPayments[i] = { ...data.value.recurringPayments[i], ...updates }
  }

  async function deleteRecurringPayment(id) {
    if (isGuest.value) {
      data.value.recurringPayments = data.value.recurringPayments.filter(p => p.id !== id)
      saveLocalData()
      return
    }
    const { error } = await supabase.from('recurring_payments').delete().eq('id', id)
    if (error) throw error
    data.value.recurringPayments = data.value.recurringPayments.filter(p => p.id !== id)
  }

  function getRecurringPayment(id)                  { return data.value.recurringPayments.find(p => p.id === id) }
  function getRecurringPaymentsByVehicle(vehicleId) { return data.value.recurringPayments.filter(p => p.vehicleId === vehicleId) }

  // ── Settings ──────────────────────────────────────────────────
  async function setTheme(theme) {
    data.value.settings.theme = theme
    document.documentElement.setAttribute('data-theme', theme)
    await persistSettings(data.value.settings)
  }
  function getTheme()              { return data.value.settings.theme }
  async function setDefaultVehicle(id) {
    data.value.settings.defaultVehicleId = id
    await persistSettings(data.value.settings)
  }
  function getDefaultVehicleId()   { return data.value.settings.defaultVehicleId }
  async function setConsumptionUnit(unit) {
    data.value.settings.consumptionUnit = unit
    await persistSettings(data.value.settings)
  }
  function getConsumptionUnit()    { return data.value.settings.consumptionUnit || 'kmL' }
  async function setSetting(key, value) {
    data.value.settings[key] = value
    await persistSettings(data.value.settings)
  }
  function getSetting(key)         { return data.value.settings[key] }

  // ── Export / Import ───────────────────────────────────────────
  function exportData()            { return JSON.stringify(data.value, null, 2) }

  function saveToFile() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'storicar-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(jsonString) {
    try {
      const imported = JSON.parse(jsonString)
      await clearAllData()
      const vehicleIdMap = {}
      for (const v of (imported.vehicles || [])) {
        const newId = await addVehicle(v)
        vehicleIdMap[v.id] = newId
      }
      for (const r of (imported.fuelRecords || []))
        await addFuelRecord({ ...r, vehicleId: vehicleIdMap[r.vehicleId] || r.vehicleId })
      for (const e of (imported.expenses || []))
        await addExpense({ ...e, vehicleId: vehicleIdMap[e.vehicleId] || e.vehicleId })
      for (const d of (imported.deadlines || []))
        await addDeadline({ ...d, vehicleId: vehicleIdMap[d.vehicleId] || d.vehicleId })
      return true
    } catch (e) {
      console.error('Errore importazione:', e)
      return false
    }
  }

  async function clearAllData() {
    if (isGuest.value) {
      data.value = emptyData()
      saveLocalData()
      return
    }
    if (!user.value) return
    await supabase.from('user_settings').delete().eq('user_id', user.value.id)
    await supabase.from('fuel_records').delete().eq('user_id', user.value.id)
    await supabase.from('expenses').delete().eq('user_id', user.value.id)
    await supabase.from('deadlines').delete().eq('user_id', user.value.id)
    await supabase.from('recurring_payments').delete().eq('user_id', user.value.id)
    await supabase.from('vehicles').delete().eq('user_id', user.value.id)
    data.value = emptyData()
  }

  function hasData() {
    return data.value.vehicles.length > 0 || data.value.fuelRecords.length > 0
  }

  return {
    data,
    dataReady,
    addVehicle, updateVehicle, deleteVehicle, getVehicle,
    addFuelRecord, updateFuelRecord, deleteFuelRecord, getFuelRecord,
    getFuelRecordsByVehicle, getLastFuelRecord, getPrevFuelRecord,
    addExpense, updateExpense, deleteExpense, getExpense, getExpensesByVehicle,
    addDeadline, updateDeadline, deleteDeadline, getDeadline,
    getDeadlinesByVehicle, getAllDeadlines,
    setTheme, getTheme, setDefaultVehicle, getDefaultVehicleId,
    setConsumptionUnit, getConsumptionUnit, setSetting, getSetting,
    addRecurringPayment, updateRecurringPayment, deleteRecurringPayment,
    getRecurringPayment, getRecurringPaymentsByVehicle,
    exportData, saveToFile, importData, hasData, clearAllData,
  }
}
