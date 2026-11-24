import { createId } from '@/lib/id'
import type {
  AppData,
  BookingStatus,
  DayPlan,
  HoursData,
  Place,
  PlacePhoto,
  Stop,
  TravelMode,
  Trip,
  WishItem,
} from '@/types'

export function emptyAppData(): AppData {
  return { version: 1, trips: [] }
}

export function createTrip(input: {
  title: string
  destination: string
  startDate?: string
  endDate?: string
  currency: string
}): Trip {
  const dates = dateSpan(input.startDate, input.endDate)
  const days = (dates.length ? dates : [undefined]).map(date => createDay(date))
  return {
    id: createId(),
    title: input.title.trim() || '未命名行程',
    destination: input.destination.trim(),
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    currency: input.currency || 'TWD',
    days,
    wishlist: [],
    updatedAt: new Date().toISOString(),
  }
}

export function createDay(date?: string): DayPlan {
  return { id: createId(), date, stops: [], travelMode: 'walking' }
}

export function clonePlace(place: Place): Place {
  return { ...place, id: createId(), photos: place.photos.map(photo => ({ ...photo })), hours: place.hours ? { ...place.hours } : undefined }
}

export function nextDate(date: string | undefined): string | undefined {
  if (!date) return undefined
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  parsed.setDate(parsed.getDate() + 1)
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${parsed.getFullYear()}-${month}-${day}`
}

function dateSpan(start?: string, end?: string): string[] {
  if (!start || !end || end < start) return start ? [start] : []
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  for (let guard = 0; guard < 21 && cursor <= last; guard += 1) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const day = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${cursor.getFullYear()}-${month}-${day}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function normalizeTrip(input: unknown): Trip | null {
  const root = unwrap(input)
  if (!root || typeof root !== 'object') return null
  const record = root as Record<string, unknown>
  if (typeof record.title !== 'string' || !Array.isArray(record.days)) return null
  const days = record.days.map(normalizeDay).filter((day): day is DayPlan => day != null)
  const wishlist = Array.isArray(record.wishlist)
    ? record.wishlist.map(normalizeWish).filter((item): item is WishItem => item != null)
    : []
  return {
    id: typeof record.id === 'string' ? record.id : createId(),
    title: record.title.trim() || '未命名行程',
    destination: typeof record.destination === 'string' ? record.destination : '',
    startDate: optionalString(record.startDate),
    endDate: optionalString(record.endDate),
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'TWD',
    timezone: optionalString(record.timezone),
    days,
    wishlist,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  }
}

function unwrap(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const record = input as Record<string, unknown>
  if (record.trip && typeof record.trip === 'object') return record.trip
  return input
}

function normalizeDay(input: unknown): DayPlan | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const stops = Array.isArray(record.stops) ? record.stops.map(normalizeStop).filter((stop): stop is Stop => stop != null) : []
  const hotel = record.hotel ? normalizePlace(record.hotel) : undefined
  return {
    id: typeof record.id === 'string' ? record.id : createId(),
    date: optionalString(record.date),
    hotel,
    stops,
    travelMode: normalizeMode(record.travelMode),
  }
}

function normalizeStop(input: unknown): Stop | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const place = normalizePlace(record.place)
  if (!place) return null
  return {
    id: typeof record.id === 'string' ? record.id : createId(),
    place,
    arrivalTime: isTime(record.arrivalTime) ? record.arrivalTime : undefined,
    cost: normalizeCost(record.cost),
    bookingStatus: normalizeBooking(record.bookingStatus),
  }
}

function normalizeWish(input: unknown): WishItem | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const place = normalizePlace(record.place)
  if (!place) return null
  return { id: typeof record.id === 'string' ? record.id : createId(), place }
}

function normalizePlace(input: unknown): Place | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  if (typeof record.name !== 'string' || !record.name.trim()) return undefined
  const lat = finiteNumber(record.lat)
  const lng = finiteNumber(record.lng)
  return {
    id: typeof record.id === 'string' ? record.id : createId(),
    name: record.name.trim(),
    address: optionalString(record.address),
    lat: lat != null && lng != null ? lat : undefined,
    lng: lat != null && lng != null ? lng : undefined,
    countryCode: optionalString(record.countryCode),
    sourceUrl: optionalString(record.sourceUrl),
    photos: normalizePhotos(record.photos),
    hours: normalizeHours(record.hours),
    hoursChecked: record.hoursChecked === true || Boolean(normalizeHours(record.hours)),
    category: optionalString(record.category),
  }
}

function normalizePhotos(input: unknown): PlacePhoto[] {
  if (!Array.isArray(input)) return []
  return input.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    if (typeof record.url !== 'string') return []
    const source = record.source === 'open-graph' || record.source === 'wikimedia' || record.source === 'osm' ? record.source : null
    if (!source) return []
    return [{ url: record.url, source }]
  })
}

function normalizeHours(input: unknown): HoursData | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  if (record.source !== 'osm' && record.source !== 'google') return undefined
  const weekdayText = Array.isArray(record.weekdayText) ? record.weekdayText.filter((item): item is string => typeof item === 'string') : undefined
  return {
    source: record.source,
    osm: optionalString(record.osm),
    weekdayText,
    periods: Array.isArray(record.periods) ? record.periods.flatMap(normalizePeriod) : undefined,
  }
}

function normalizePeriod(input: unknown) {
  if (!input || typeof input !== 'object') return []
  const record = input as Record<string, unknown>
  const open = point(record.open)
  if (!open) return []
  if (!record.close) return [{ open }]
  const close = point(record.close)
  if (!close) return []
  return [{ open, close }]
}

function point(input: unknown): { day: number; time: string } | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  if (typeof record.day !== 'number' || typeof record.time !== 'string' || !/^\d{4}$/.test(record.time)) return null
  return { day: record.day, time: record.time }
}

function normalizeMode(input: unknown): TravelMode {
  return input === 'driving' || input === 'walking' || input === 'transit' ? input : 'walking'
}

function normalizeBooking(input: unknown): BookingStatus {
  return input === 'not_booked' || input === 'booked' || input === 'paid' ? input : 'not_booked'
}

function normalizeCost(input: unknown): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0) return undefined
  return input
}

function finiteNumber(input: unknown): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined
}

function optionalString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input : undefined
}

function isTime(input: unknown): input is string {
  return typeof input === 'string' && /^\d{2}:\d{2}$/.test(input)
}
