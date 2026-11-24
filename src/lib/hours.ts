import OpeningHours from 'opening_hours'
import type { HoursData, HoursPeriod, Place } from '@/types'

export type HoursJudgement = {
  level: 'ok' | 'warn'
  title: string
  detail: string
}

type DayPattern = 'opens' | 'closed' | 'unknown'
type InstantState = 'open' | 'closed' | 'unknown'

export function judgeHours(place: Place, date: string | undefined, arrival: string | undefined): HoursJudgement {
  const hours = place.hours
  const raw = hoursLabel(hours)
  if (!place.hoursChecked && !hours) {
    return { level: 'warn', title: '尚未查到營業時間', detail: '還在確認這個地點有沒有營業時間資料。' }
  }
  if (!hours || !raw) {
    return {
      level: 'warn',
      title: '無法確認營業時間',
      detail: 'OpenStreetMap 沒有這個地點的營業時間。可在設定貼上 Google 金鑰後再查，或直接向店家確認。',
    }
  }
  if (!date) {
    return {
      level: 'warn',
      title: '無法判斷屆時是否營業',
      detail: `這一天還沒有日期。營業時間：${raw}`,
    }
  }
  const day = parseCivilDate(date)
  if (!day) {
    return { level: 'warn', title: '無法判斷屆時是否營業', detail: `日期格式無法讀取。營業時間：${raw}` }
  }
  const pattern = dayPattern(hours, place, day)
  if (pattern === 'unknown') {
    return {
      level: 'warn',
      title: '無法判斷這一天是否營業',
      detail: `有營業時間資料，但無法可靠解讀。原始資料：${raw}`,
    }
  }
  if (pattern === 'closed') {
    return { level: 'warn', title: '這一天可能不營業', detail: `營業時間：${raw}` }
  }
  if (!arrival) {
    return {
      level: 'warn',
      title: '尚未填預計抵達時間，無法確認屆時是否營業',
      detail: `營業時間：${raw}`,
    }
  }
  const when = parseCivilDate(date, arrival)
  if (!when) {
    return { level: 'warn', title: '無法判斷屆時是否營業', detail: `抵達時間無法讀取。營業時間：${raw}` }
  }
  const state = instantState(hours, place, when)
  if (state === 'unknown') {
    return {
      level: 'warn',
      title: '無法判斷這個抵達時刻是否營業',
      detail: `有營業時間資料，但這個時刻無法可靠解讀。原始資料：${raw}`,
    }
  }
  if (state === 'closed') {
    return { level: 'warn', title: '預計抵達時可能已打烊或尚未營業', detail: `營業時間：${raw}` }
  }
  const source = hours.source === 'google' ? 'Google Places' : 'OpenStreetMap'
  return { level: 'ok', title: '預計抵達時應在營業時間內', detail: `依 ${source}：${raw}` }
}

export function hoursLabel(hours: HoursData | undefined): string | undefined {
  if (!hours) return undefined
  if (hours.source === 'osm' && hours.osm?.trim()) return hours.osm.trim()
  if (hours.weekdayText?.length) return hours.weekdayText.join('；')
  return undefined
}

function dayPattern(hours: HoursData, place: Place, day: Date): DayPattern {
  if (hours.source === 'osm' && hours.osm) return osmDayPattern(hours.osm, place, day)
  if (hours.periods?.length) return googleDayPattern(hours.periods, day)
  return 'unknown'
}

function instantState(hours: HoursData, place: Place, when: Date): InstantState {
  if (hours.source === 'osm' && hours.osm) return osmAt(hours.osm, place, when)
  if (hours.periods?.length) return googleAt(hours.periods, when)
  return 'unknown'
}

function osmDayPattern(raw: string, place: Place, day: Date): DayPattern {
  const engine = buildEngine(raw, place)
  if (!engine) return 'unknown'
  try {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const intervals = engine.getOpenIntervals(start, end)
    if (intervals.some(interval => interval[2] !== true)) return 'opens'
    if (intervals.some(interval => interval[2] === true)) return 'unknown'
    const noon = new Date(start)
    noon.setHours(12)
    if (engine.getUnknown(noon)) return 'unknown'
    return 'closed'
  } catch {
    return 'unknown'
  }
}

function osmAt(raw: string, place: Place, when: Date): InstantState {
  const engine = buildEngine(raw, place)
  if (!engine) return 'unknown'
  try {
    if (engine.getUnknown(when)) return 'unknown'
    return engine.getState(when) ? 'open' : 'closed'
  } catch {
    return 'unknown'
  }
}

function buildEngine(raw: string, place: Place): OpeningHours | null {
  try {
    if (place.lat == null || place.lng == null) return new OpeningHours(raw)
    return new OpeningHours(raw, {
      lat: place.lat,
      lon: place.lng,
      address: place.countryCode ? { country_code: place.countryCode } : undefined,
    } as unknown as { lat: string; lon: string; address?: { country_code?: string } })
  } catch {
    return null
  }
}

export function googleAt(periods: HoursPeriod[], when: Date): InstantState {
  const day = when.getDay()
  const minutes = when.getHours() * 60 + when.getMinutes()
  let sawPeriod = false
  for (const period of periods) {
    const open = toMinutes(period.open.time)
    if (open == null || !Number.isInteger(period.open.day)) return 'unknown'
    sawPeriod = true
    if (!period.close) {
      if (period.open.day === day && minutes >= open) return 'open'
      continue
    }
    const close = toMinutes(period.close.time)
    if (close == null || !Number.isInteger(period.close.day)) return 'unknown'
    if (covers(period.open.day, open, period.close.day, close, day, minutes)) return 'open'
  }
  return sawPeriod ? 'closed' : 'unknown'
}

function googleDayPattern(periods: HoursPeriod[], day: Date): DayPattern {
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0)
      const state = googleAt(periods, when)
      if (state === 'unknown') return 'unknown'
      if (state === 'open') return 'opens'
    }
  }
  return 'closed'
}

function covers(openDay: number, open: number, closeDay: number, close: number, day: number, minutes: number): boolean {
  if (openDay === closeDay) return day === openDay && minutes >= open && minutes < close
  const next = (openDay + 1) % 7
  if (closeDay !== next && closeDay !== openDay) {
    if (day === openDay && minutes >= open) return true
    if (day === closeDay && minutes < close) return true
    return false
  }
  if (day === openDay && minutes >= open) return true
  if (day === closeDay && minutes < close) return true
  return false
}

function toMinutes(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null
  const hour = Number(value.slice(0, 2))
  const minute = Number(value.slice(2))
  if (hour > 24 || minute > 59) return null
  return hour * 60 + minute
}

export function parseCivilDate(date: string, time = '00:00'): Date | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const clock = time.match(/^(\d{2}):(\d{2})$/)
  if (!match || !clock) return null
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(clock[1]), Number(clock[2]), 0, 0)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}
