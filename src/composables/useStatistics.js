import { computed } from 'vue'
import { useStorage } from './useStorage'

export function useStatistics(vehicleId, filters = null) {
  const { getFuelRecordsByVehicle, getExpensesByVehicle, getVehicle, getConsumptionUnit } = useStorage()

  const consumptionUnit = computed(() => getConsumptionUnit())

  const allFuelRecords = computed(() => {
    if (!vehicleId.value) return []
    return getFuelRecordsByVehicle(vehicleId.value)
  })

  const allExpenses = computed(() => {
    if (!vehicleId.value) return []
    return getExpensesByVehicle(vehicleId.value)
  })

  // Apply period filter if provided
  const fuelRecords = computed(() => {
    if (!filters?.value?.from && !filters?.value?.to) return allFuelRecords.value
    return allFuelRecords.value.filter(r => {
      const d = new Date(r.date)
      if (filters.value.from && d < new Date(filters.value.from)) return false
      if (filters.value.to && d > new Date(filters.value.to + 'T23:59:59')) return false
      return true
    })
  })

  const expenses = computed(() => {
    if (!filters?.value?.from && !filters?.value?.to) return allExpenses.value
    return allExpenses.value.filter(e => {
      const d = new Date(e.date)
      if (filters.value.from && d < new Date(filters.value.from)) return false
      if (filters.value.to && d > new Date(filters.value.to + 'T23:59:59')) return false
      return true
    })
  })

  const vehicle = computed(() => {
    if (!vehicleId.value) return null
    return getVehicle(vehicleId.value)
  })

  // Records sorted oldest-first for sequential pairing
  const sortedAscRecords = computed(() => fuelRecords.value.slice().reverse())

  // Enrich each record with effectiveKm
  const recordsWithEffectiveKm = computed(() => {
    const allAsc = allFuelRecords.value.slice().reverse()
    return sortedAscRecords.value.map((record) => {
      const allIdx = allAsc.findIndex(r => r.id === record.id)
      const prev = allIdx > 0 ? allAsc[allIdx - 1] : null
      let effectiveKm = record.kmDriven ?? 0

      if (
        record.remainingRange != null &&
        prev != null &&
        prev.remainingRange != null &&
        record.odometer != null &&
        prev.odometer != null
      ) {
        const corrected = (record.odometer - prev.odometer) + prev.remainingRange - record.remainingRange
        if (corrected > 0) effectiveKm = corrected
      }

      return { ...record, effectiveKm }
    })
  })

  // Fuel statistics
  const totalFuelSpent = computed(() =>
    fuelRecords.value.reduce((sum, r) => sum + (r.amount || 0), 0)
  )

  const totalLiters = computed(() =>
    fuelRecords.value.reduce((sum, r) => sum + (r.liters || 0), 0)
  )

  const totalKmDriven = computed(() =>
    recordsWithEffectiveKm.value.reduce((sum, r) => sum + (r.effectiveKm || 0), 0)
  )

  const averageConsumption = computed(() => {
    if (totalKmDriven.value === 0 || totalLiters.value === 0) return 0
    return totalKmDriven.value / totalLiters.value
  })

  const averageConsumptionPer100km = computed(() => {
    if (totalKmDriven.value === 0 || totalLiters.value === 0) return 0
    return (totalLiters.value / totalKmDriven.value) * 100
  })

  const formattedConsumption = computed(() => {
    if (consumptionUnit.value === 'L100km') {
      return { value: averageConsumptionPer100km.value, unit: 'L/100km' }
    }
    return { value: averageConsumption.value, unit: 'km/L' }
  })

  const averagePricePerLiter = computed(() => {
    const records = fuelRecords.value.filter(r => r.pricePerLiter)
    if (!records.length) return 0
    return records.reduce((s, r) => s + r.pricePerLiter, 0) / records.length
  })

  const costPerKm = computed(() => {
    if (totalKmDriven.value === 0) return 0
    return totalFuelSpent.value / totalKmDriven.value
  })

  const averageFuelSpentPerMonth = computed(() => {
    if (fuelRecords.value.length < 2) return totalFuelSpent.value
    const dates = fuelRecords.value.map(r => new Date(r.date))
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    const months = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30) || 1
    return totalFuelSpent.value / months
  })

  const lastOdometer = computed(() => {
    const recordsWithOdometer = fuelRecords.value.filter(r => r.odometer)
    if (recordsWithOdometer.length === 0) return vehicle.value?.initialOdometer || 0
    return Math.max(...recordsWithOdometer.map(r => r.odometer))
  })

  // ── Refuel intervals ──
  const refuelIntervals = computed(() => {
    const asc = allFuelRecords.value.slice().reverse()
    if (asc.length < 2) return []
    const intervals = []
    for (let i = 1; i < asc.length; i++) {
      const prev = asc[i - 1]
      const curr = asc[i]
      const days = Math.round((new Date(curr.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24))
      const allAsc = recordsWithEffectiveKm.value
      const enriched = allAsc.find(r => r.id === curr.id)
      intervals.push({
        fromDate: prev.date,
        toDate: curr.date,
        days,
        effectiveKm: enriched?.effectiveKm ?? curr.kmDriven ?? 0,
        liters: curr.liters || 0,
        amount: curr.amount || 0
      })
    }
    return intervals
  })

  const avgDaysBetweenRefuels = computed(() => {
    if (!refuelIntervals.value.length) return 0
    return refuelIntervals.value.reduce((s, i) => s + i.days, 0) / refuelIntervals.value.length
  })

  const avgKmBetweenRefuels = computed(() => {
    const valid = refuelIntervals.value.filter(i => i.effectiveKm > 0)
    if (!valid.length) return 0
    return valid.reduce((s, i) => s + i.effectiveKm, 0) / valid.length
  })

  const maxDaysBetweenRefuels = computed(() => {
    if (!refuelIntervals.value.length) return null
    return refuelIntervals.value.reduce((max, i) => i.days > max.days ? i : max)
  })

  const minDaysBetweenRefuels = computed(() => {
    if (!refuelIntervals.value.length) return null
    return refuelIntervals.value.reduce((min, i) => i.days < min.days ? i : min)
  })

  // ── Other expenses ──
  const totalOtherExpenses = computed(() =>
    expenses.value.reduce((sum, e) => sum + (e.amount || 0), 0)
  )

  const expensesByCategory = computed(() => {
    const categories = {}
    expenses.value.forEach(e => {
      const cat = e.category || 'other'
      if (!categories[cat]) categories[cat] = 0
      categories[cat] += e.amount || 0
    })
    return categories
  })

  // ── Total ──
  const totalSpent = computed(() => totalFuelSpent.value + totalOtherExpenses.value)

  const totalCostPerKm = computed(() => {
    if (totalKmDriven.value === 0) return 0
    return totalSpent.value / totalKmDriven.value
  })

  // ── Chart data ──
  const fuelPriceHistory = computed(() =>
    fuelRecords.value.slice().reverse().map(r => ({ date: r.date, price: r.pricePerLiter }))
  )

  // Consumo fill-to-fill: solo tra pieni completi (fullTank !== false).
  // Per ogni pieno N: km = odo_N - odo_{prevFull}
  //                   litri = somma da prevFull+1 a N incluso
  const consumptionHistory = computed(() => {
    const asc = allFuelRecords.value.slice().reverse() // tutti, dal più vecchio
    const result = []
    let prevFullIdx = -1

    for (let i = 0; i < asc.length; i++) {
      const r = asc[i]
      const isFull = r.fullTank !== false

      if (isFull && prevFullIdx >= 0) {
        const prevFull = asc[prevFullIdx]
        const km = (r.odometer ?? 0) - (prevFull.odometer ?? 0)
        if (km > 0) {
          let totalLiters = 0
          for (let j = prevFullIdx + 1; j <= i; j++) {
            totalLiters += asc[j].liters ?? 0
          }
          if (totalLiters > 0) {
            result.push({
              date: r.date,
              consumption: consumptionUnit.value === 'L100km'
                ? (totalLiters / km) * 100
                : km / totalLiters
            })
          }
        }
      }

      if (isFull) prevFullIdx = i
    }

    return result
  })

  const monthlySpending = computed(() => {
    const monthly = {}
    allFuelRecords.value.forEach(r => {
      const month = r.date.substring(0, 7)
      if (!monthly[month]) monthly[month] = { fuel: 0, other: 0 }
      monthly[month].fuel += r.amount || 0
    })
    allExpenses.value.forEach(e => {
      const month = e.date.substring(0, 7)
      if (!monthly[month]) monthly[month] = { fuel: 0, other: 0 }
      monthly[month].other += e.amount || 0
    })
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data, total: data.fuel + data.other }))
  })

  // ── Confronto anni ──
  const yearlyComparison = computed(() => {
    const years = {}
    allFuelRecords.value.forEach(r => {
      const y = new Date(r.date).getFullYear()
      if (!years[y]) years[y] = { fuel: 0, other: 0, liters: 0, refuels: 0 }
      years[y].fuel += r.amount || 0
      years[y].liters += r.liters || 0
      years[y].refuels++
    })
    allExpenses.value.forEach(e => {
      const y = new Date(e.date).getFullYear()
      if (!years[y]) years[y] = { fuel: 0, other: 0, liters: 0, refuels: 0 }
      years[y].other += e.amount || 0
    })
    return Object.entries(years)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([year, data]) => ({ year: Number(year), ...data, total: data.fuel + data.other }))
  })

  // ── Statistiche per mese dell'anno (media stagionale) ──
  const monthlyAverage = computed(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, fuel: 0, other: 0, count: 0 }))
    allFuelRecords.value.forEach(r => {
      const m = new Date(r.date).getMonth()
      byMonth[m].fuel += r.amount || 0
      byMonth[m].count++
    })
    allExpenses.value.forEach(e => {
      const m = new Date(e.date).getMonth()
      byMonth[m].other += e.amount || 0
    })
    // Dividi per anni distinti
    const distinctYears = new Set([
      ...allFuelRecords.value.map(r => new Date(r.date).getFullYear()),
      ...allExpenses.value.map(e => new Date(e.date).getFullYear())
    ])
    const numYears = Math.max(1, distinctYears.size)
    return byMonth.map(m => ({
      ...m,
      fuelAvg: m.fuel / numYears,
      otherAvg: m.other / numYears,
      totalAvg: (m.fuel + m.other) / numYears
    }))
  })

  // ── Trend consumo (media mobile 3 rifornimenti) ──
  const consumptionTrend = computed(() => {
    const history = consumptionHistory.value
    if (history.length < 3) return history
    return history.map((c, i) => {
      if (i < 2) return { ...c, trend: c.consumption }
      const avg = (history[i].consumption + history[i-1].consumption + history[i-2].consumption) / 3
      return { ...c, trend: avg }
    })
  })

  // ── Previsione spesa mensile ──
  const monthlyForecast = computed(() => {
    const months = monthlySpending.value
    if (months.length < 2) return null
    // Media degli ultimi 3 mesi disponibili
    const last3 = months.slice(-3)
    const avgTotal = last3.reduce((s, m) => s + m.total, 0) / last3.length
    const avgFuel = last3.reduce((s, m) => s + m.fuel, 0) / last3.length
    const avgOther = last3.reduce((s, m) => s + m.other, 0) / last3.length
    return { total: avgTotal, fuel: avgFuel, other: avgOther, basedOn: last3.length }
  })

  // ── Spesa annua prevista ──
  const annualForecast = computed(() => {
    if (!monthlyForecast.value) return null
    return {
      total: monthlyForecast.value.total * 12,
      fuel: monthlyForecast.value.fuel * 12,
      other: monthlyForecast.value.other * 12
    }
  })

  // ── Lista rifornimenti con consumo calcolato (fill-to-fill) ──
  const detailedFuelList = computed(() => {
    // Usa tutti i record ASC per trovare il pieno precedente anche fuori dal filtro
    const allAsc = allFuelRecords.value.slice().reverse()
    // Mappa id → { km, liters, kmPerL }
    const cMap = {}
    let prevFullIdx = -1

    for (let i = 0; i < allAsc.length; i++) {
      const r = allAsc[i]
      const isFull = r.fullTank !== false

      if (isFull && prevFullIdx >= 0) {
        const prevFull = allAsc[prevFullIdx]
        const km = (r.odometer ?? 0) - (prevFull.odometer ?? 0)
        if (km > 0) {
          let totalLiters = 0
          for (let j = prevFullIdx + 1; j <= i; j++) {
            totalLiters += allAsc[j].liters ?? 0
          }
          if (totalLiters > 0) {
            cMap[r.id] = { km, liters: totalLiters, kmPerL: km / totalLiters }
          }
        }
      }

      if (isFull) prevFullIdx = i
    }

    // Arricchisci i record filtrati con il consumo calcolato
    return recordsWithEffectiveKm.value
      .slice()
      .reverse()
      .map(r => {
        const c = r.fullTank !== false ? cMap[r.id] : null
        return {
          ...r,
          computedConsumption: c
            ? consumptionUnit.value === 'L100km'
              ? (c.liters / c.km) * 100
              : c.kmPerL
            : null,
          costPerKm: r.effectiveKm && r.amount
            ? r.amount / r.effectiveKm
            : null
        }
      })
  })

  // ── Efficienza nel tempo: migliorata o peggiorata ──
  const efficiencyTrend = computed(() => {
    const hist = consumptionHistory.value
    if (hist.length < 4) return null
    const firstHalf = hist.slice(0, Math.floor(hist.length / 2))
    const secondHalf = hist.slice(Math.floor(hist.length / 2))
    const avgFirst = firstHalf.reduce((s, c) => s + c.consumption, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, c) => s + c.consumption, 0) / secondHalf.length
    const diff = avgSecond - avgFirst
    // L100km: diff > 0 = peggiorato, diff < 0 = migliorato
    // kmL:    diff > 0 = migliorato, diff < 0 = peggiorato
    const improved = consumptionUnit.value === 'L100km' ? diff < 0 : diff > 0
    return { avgFirst, avgSecond, diff: Math.abs(diff), improved }
  })

  // ── Anno corrente stats ──
  const currentYear = new Date().getFullYear()

  const thisYearFuelSpent = computed(() =>
    allFuelRecords.value
      .filter(r => new Date(r.date).getFullYear() === currentYear)
      .reduce((s, r) => s + (r.amount || 0), 0)
  )

  const thisYearExpensesSpent = computed(() =>
    allExpenses.value
      .filter(e => new Date(e.date).getFullYear() === currentYear)
      .reduce((s, e) => s + (e.amount || 0), 0)
  )

  const thisYearLiters = computed(() =>
    allFuelRecords.value
      .filter(r => new Date(r.date).getFullYear() === currentYear)
      .reduce((s, r) => s + (r.liters || 0), 0)
  )

  const thisYearRefuels = computed(() =>
    allFuelRecords.value.filter(r => new Date(r.date).getFullYear() === currentYear).length
  )

  // ── Top stazioni/luoghi ──
  const topStations = computed(() => {
    const map = {}
    allFuelRecords.value.forEach(r => {
      const s = r.station || r.location || 'Non specificato'
      if (!map[s]) map[s] = { count: 0, totalAmount: 0, totalLiters: 0 }
      map[s].count++
      map[s].totalAmount += r.amount || 0
      map[s].totalLiters += r.liters || 0
    })
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d, avgPrice: d.totalLiters ? d.totalAmount / d.totalLiters : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  })

  // ── Distribuzione per giorno della settimana ──
  const refuelsByDayOfWeek = computed(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
    const counts = Array(7).fill(0)
    allFuelRecords.value.forEach(r => {
      counts[new Date(r.date).getDay()]++
    })
    return days.map((name, i) => ({ name, count: counts[i] }))
  })

  return {
    fuelRecords,
    allFuelRecords,
    expenses,
    vehicle,
    consumptionUnit,
    // Fuel stats
    totalFuelSpent,
    totalLiters,
    totalKmDriven,
    averageConsumption,
    averageConsumptionPer100km,
    formattedConsumption,
    averagePricePerLiter,
    costPerKm,
    averageFuelSpentPerMonth,
    lastOdometer,
    // Effective km
    effectiveKmRecords: recordsWithEffectiveKm,
    // Refuel intervals
    refuelIntervals,
    avgDaysBetweenRefuels,
    avgKmBetweenRefuels,
    maxDaysBetweenRefuels,
    minDaysBetweenRefuels,
    // Other expenses
    totalOtherExpenses,
    expensesByCategory,
    // Total
    totalSpent,
    totalCostPerKm,
    // Charts
    fuelPriceHistory,
    consumptionHistory,
    monthlySpending,
    // New advanced stats
    yearlyComparison,
    monthlyAverage,
    consumptionTrend,
    monthlyForecast,
    annualForecast,
    detailedFuelList,
    efficiencyTrend,
    // Current year
    thisYearFuelSpent,
    thisYearExpensesSpent,
    thisYearLiters,
    thisYearRefuels,
    // Top stations / day distribution
    topStations,
    refuelsByDayOfWeek
  }
}
