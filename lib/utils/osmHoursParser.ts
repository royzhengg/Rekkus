/**
 * Parses OSM opening_hours strings into a 7-element weekday_text array
 * (same shape as Google Places API) and computes open_now in the venue's timezone.
 *
 * OSM hours are always in the venue's LOCAL time — never UTC.
 * We compute open_now by looking up the venue's IANA timezone from its lat/lng,
 * then comparing the current time in that timezone against the parsed schedule.
 */

const OSM_DAYS: Record<string, number> = {
  Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6,
}
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatOsmTime(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function expandDays(daySpec: string): number[] {
  const days: number[] = []
  for (const segment of daySpec.split(',')) {
    const s = segment.trim()
    const dashIdx = s.indexOf('-')
    if (dashIdx !== -1) {
      const from = OSM_DAYS[s.slice(0, dashIdx)] ?? 0
      const to = OSM_DAYS[s.slice(dashIdx + 1)] ?? 6
      for (let i = from; i <= to; i++) days.push(i)
    } else {
      const idx = OSM_DAYS[s]
      if (idx !== undefined) days.push(idx)
    }
  }
  return days
}

// Each time interval within a rule, e.g. "09:00-17:00" or "09:00-12:00,14:00-18:00"
interface Interval {
  openMin: number   // minutes since midnight
  closeMin: number
}

function parseIntervals(timeSpec: string): Interval[] | null {
  if (timeSpec === 'off' || timeSpec === 'closed') return null
  const intervals: Interval[] = []
  for (const range of timeSpec.split(',')) {
    const parts = range.trim().split('-')
    if (parts.length < 2) continue
    const [hh1, mm1] = (parts[0] ?? '').split(':').map(Number)
    const [hh2, mm2] = (parts[1] ?? '').split(':').map(Number)
    if (isNaN(hh1 ?? NaN) || isNaN(hh2 ?? NaN)) continue
    intervals.push({ openMin: (hh1 ?? 0) * 60 + (mm1 ?? 0), closeMin: (hh2 ?? 0) * 60 + (mm2 ?? 0) })
  }
  return intervals.length > 0 ? intervals : null
}

function formatIntervals(intervals: Interval[] | null | undefined): string {
  if (!intervals) return 'Closed'
  return intervals
    .map(iv => {
      const oh = Math.floor(iv.openMin / 60)
      const om = iv.openMin % 60
      const ch = Math.floor(iv.closeMin / 60)
      const cm = iv.closeMin % 60
      return `${formatOsmTime(`${oh}:${String(om).padStart(2, '0')}`)} – ${formatOsmTime(`${ch}:${String(cm).padStart(2, '0')}`)}`
    })
    .join(', ')
}

/**
 * Rough IANA timezone from lat/lng for Australia.
 * Good enough for AU — for future international expansion use a proper tz lookup.
 */
function auTimezone(lat: number, lng: number): string {
  if (lng < 129) return 'Australia/Perth'          // WA
  if (lng < 138) return lat < -25 ? 'Australia/Adelaide' : 'Australia/Darwin'
  if (lng < 141) return 'Australia/Brisbane'       // QLD border / SA
  if (lat < -43.5) return 'Australia/Hobart'       // TAS
  if (lat > -29 && lng > 141) return 'Australia/Brisbane' // QLD
  if (lat < -34.5 && lng > 147 && lng < 151) return 'Australia/Melbourne' // VIC
  return 'Australia/Sydney'                         // NSW / ACT default
}

export interface ParsedOsmHours {
  weekday_text: string[]
  open_now?: boolean
}

export function parseOsmHours(hoursText: string, lat?: number, lng?: number): ParsedOsmHours {
  const normalized = hoursText.trim()

  if (normalized === '24/7') {
    return {
      weekday_text: DAY_NAMES.map(d => `${d}: Open 24 hours`),
      open_now: true,
    }
  }

  // schedule[day] = array of intervals (null = closed all day)
  const schedule: (Interval[] | null)[] = Array.from({ length: 7 }, () => null)

  for (const rule of normalized.split(';')) {
    const trimmed = rule.trim()
    if (!trimmed) continue

    // Match day-spec (required) + time-spec (required)
    // Day spec: up to 3 segments separated by commas, each "Mo" or "Mo-Fr"
    const match = trimmed.match(
      /^((?:[A-Z][a-z](?:-[A-Z][a-z])?(?:,\s*[A-Z][a-z](?:-[A-Z][a-z])?)*))\s+(.+)$/
    )
    if (!match) continue

    const [, dayPart, timePart] = match
    const days = expandDays(dayPart ?? '')
    const intervals = timePart?.trim() === '24/7' || timePart?.trim() === 'open'
      ? [{ openMin: 0, closeMin: 24 * 60 }]
      : parseIntervals(timePart?.trim() ?? '')

    for (const d of days) {
      if (d >= 0 && d < 7) schedule[d] = intervals
    }
  }

  const weekday_text = DAY_NAMES.map((name, i) => {
    const intervals = schedule[i] ?? null
    return `${name}: ${formatIntervals(intervals)}`
  })

  // Compute open_now in venue's local timezone
  let open_now: boolean | undefined
  if (lat !== undefined && lng !== undefined) {
    try {
      const tz = auTimezone(lat, lng)
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: tz,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      })
      const parts = formatter.formatToParts(now)
      const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? ''
      const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0'
      const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '0'

      const osmWeekdayMap: Record<string, number> = {
        Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
      }
      const dayIdx = osmWeekdayMap[weekdayStr] ?? -1
      const nowMin = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10)

      if (dayIdx >= 0 && dayIdx < 7) {
        const todayIntervals = schedule[dayIdx]
        if (!todayIntervals) {
          open_now = false
        } else {
          open_now = todayIntervals.some(iv => nowMin >= iv.openMin && nowMin < iv.closeMin)
        }
      }
    } catch {
      // Intl not supported or tz unknown — leave open_now undefined
    }
  }

  if (open_now !== undefined) {
    return { weekday_text, open_now }
  }
  return { weekday_text }
}
