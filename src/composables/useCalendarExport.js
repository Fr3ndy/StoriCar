/**
 * useCalendarExport.js
 * Esporta le scadenze verso Google Calendar (link diretto) o come file .ics
 * (compatibile con Google Calendar, Apple Calendar, Outlook, ecc.)
 */

function pad(n) {
  return String(n).padStart(2, '0')
}

/** 'YYYY-MM-DD' -> 'YYYYMMDD' */
function dateToIcsDate(dateStr) {
  return (dateStr || '').replace(/-/g, '')
}

/** 'YYYY-MM-DD' + giorni -> 'YYYYMMDD' (per DTEND esclusivo negli eventi "tutto il giorno") */
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function escapeIcsText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function nowStampUtc() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function useCalendarExport() {
  function eventTitle(dl, typeLabel, vehicleName) {
    return `${typeLabel}${vehicleName ? ' – ' + vehicleName : ''}`
  }

  function eventDescription(dl, vehicleName) {
    const parts = []
    if (vehicleName) parts.push(`Veicolo: ${vehicleName}`)
    if (dl.description) parts.push(dl.description)
    if (dl.amount != null && dl.amount !== '') parts.push(`Importo: € ${Number(dl.amount).toFixed(2)}`)
    if (dl.notes) parts.push(dl.notes)
    parts.push('Generato da Storicar')
    return parts.join('\n')
  }

  /** Link "quick add" di Google Calendar per una singola scadenza */
  function googleCalendarUrl(dl, typeLabel, vehicleName) {
    const start = dateToIcsDate(dl.expiryDate)
    const end = addDaysToDateStr(dl.expiryDate, 1)
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: eventTitle(dl, typeLabel, vehicleName),
      dates: `${start}/${end}`,
      details: eventDescription(dl, vehicleName),
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  function openInGoogleCalendar(dl, typeLabel, vehicleName) {
    window.open(googleCalendarUrl(dl, typeLabel, vehicleName), '_blank', 'noopener')
  }

  function buildVEvent(dl, typeLabel, vehicleName) {
    const start = dateToIcsDate(dl.expiryDate)
    const end = addDaysToDateStr(dl.expiryDate, 1)
    const uid = `storicar-${dl.id}@storicar.app`
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStampUtc()}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcsText(eventTitle(dl, typeLabel, vehicleName))}`,
      `DESCRIPTION:${escapeIcsText(eventDescription(dl, vehicleName))}`,
    ]
    const reminderDays = dl.reminderDays != null ? parseInt(dl.reminderDays) : 30
    if (reminderDays > 0) {
      lines.push(
        'BEGIN:VALARM',
        `TRIGGER:-P${reminderDays}D`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText('Promemoria: ' + eventTitle(dl, typeLabel, vehicleName))}`,
        'END:VALARM'
      )
    }
    lines.push('END:VEVENT')
    return lines
  }

  function buildIcsCalendar(eventsLines) {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Storicar//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...eventsLines.flat(),
      'END:VCALENDAR',
    ].join('\r\n')
  }

  function downloadIcsFile(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function slugify(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  /** Scarica un .ics per una singola scadenza */
  function exportDeadlineIcs(dl, typeLabel, vehicleName) {
    const ics = buildIcsCalendar([buildVEvent(dl, typeLabel, vehicleName)])
    downloadIcsFile(`scadenza-${slugify(typeLabel)}-${dl.expiryDate}.ics`, ics)
  }

  /**
   * Scarica un .ics con più scadenze insieme.
   * @param {Array<{dl:object, typeLabel:string, vehicleName:string}>} items
   */
  function exportDeadlinesIcs(items, filename = 'scadenze-storicar.ics') {
    const eventsLines = items.map(({ dl, typeLabel, vehicleName }) => buildVEvent(dl, typeLabel, vehicleName))
    const ics = buildIcsCalendar(eventsLines)
    downloadIcsFile(filename, ics)
  }

  return {
    googleCalendarUrl,
    openInGoogleCalendar,
    exportDeadlineIcs,
    exportDeadlinesIcs,
  }
}
