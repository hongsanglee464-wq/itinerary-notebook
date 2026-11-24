import { googleTransitLeg } from '@/lib/google'
import { decodePolyline } from '@/lib/polyline'
import type { DayPlan, DayRoute, RouteLeg, TravelMode } from '@/types'

export type RoutePoint = { name: string; lat: number; lng: number }

export type RouteOptions = {
  date?: string
  timeZone?: string
  googleKey?: string
  omitted: string[]
}

export function routeEndpoints(day: DayPlan): { points: RoutePoint[]; omitted: string[] } {
  const points: RoutePoint[] = []
  const omitted: string[] = []
  const consider = (name: string, lat?: number, lng?: number) => {
    if (lat == null || lng == null) omitted.push(name)
    else points.push({ name, lat, lng })
  }
  if (day.hotel) consider(day.hotel.name, day.hotel.lat, day.hotel.lng)
  for (const stop of day.stops) consider(stop.place.name, stop.place.lat, stop.place.lng)
  return { points, omitted }
}

export function routeSignature(
  mode: TravelMode,
  date: string | undefined,
  timeZone: string | undefined,
  points: RoutePoint[],
  omitted: string[],
  googleKey?: string,
): string {
  const coords = points.map(point => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(';')
  const keyFlag = mode === 'transit' && googleKey ? 'g' : ''
  return ['2', mode, date ?? '', timeZone ?? '', keyFlag, coords, omitted.join('|')].join('~')
}

export function combineLegs(legs: RouteLeg[]): { distanceMeters: number | null; durationSeconds: number | null } {
  if (!legs.length || legs.some(leg => leg.error || leg.durationSeconds == null)) {
    return { distanceMeters: null, durationSeconds: null }
  }
  const distanceOk = legs.every(leg => leg.distanceMeters != null)
  return {
    distanceMeters: distanceOk ? legs.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0) : null,
    durationSeconds: legs.reduce((sum, leg) => sum + (leg.durationSeconds ?? 0), 0),
  }
}

export async function routeBetween(
  points: RoutePoint[],
  mode: TravelMode,
  options: RouteOptions,
): Promise<Omit<DayRoute, 'signature'>> {
  const base = {
    mode,
    omitted: options.omitted,
    calculatedAt: new Date().toISOString(),
    geometry: [] as Array<[number, number]>,
    legs: [] as RouteLeg[],
    distanceMeters: null,
    durationSeconds: null,
  }
  if (points.length < 2) {
    return { ...base, error: '至少需要兩個有座標的點才能計算路線。' }
  }
  try {
    if (mode === 'driving' || mode === 'walking') return { ...base, ...(await osrmRoute(points, mode)) }
    return { ...base, ...(await transitRoute(points, options)) }
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : '無法計算路線。' }
  }
}

export function osrmEndpoint(mode: TravelMode): string {
  if (mode === 'walking') return 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
  return 'https://routing.openstreetmap.de/routed-car/route/v1/driving'
}

async function osrmRoute(points: RoutePoint[], mode: TravelMode): Promise<Partial<DayRoute>> {
  const coords = points.map(point => `${point.lng},${point.lat}`).join(';')
  const url = `${osrmEndpoint(mode)}/${coords}?overview=full&geometries=geojson&steps=false`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(mode === 'walking' ? '步行路線服務暫時無法連線。' : '開車路線服務暫時無法連線。')
  }
  const data = (await response.json()) as {
    code?: string
    message?: string
    routes?: Array<{
      distance?: number
      duration?: number
      geometry?: { coordinates?: Array<[number, number]> }
      legs?: Array<{ distance?: number; duration?: number }>
    }>
  }
  if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.code === 'NoRoute' ? '找不到可通行的路線。' : `OSRM 無法計算路線（${data.code || response.status}）。`)
  }
  const route = data.routes[0]
  const legs = (route.legs ?? []).map((leg, index) => ({
    fromName: points[index]?.name ?? '',
    toName: points[index + 1]?.name ?? '',
    distanceMeters: typeof leg.distance === 'number' ? leg.distance : null,
    durationSeconds: typeof leg.duration === 'number' ? leg.duration : null,
  }))
  const totals = combineLegs(legs)
  const geometry = (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number])
  return {
    source: 'osrm',
    legs,
    geometry,
    distanceMeters: totals.distanceMeters,
    durationSeconds: totals.durationSeconds,
    departureNote: mode === 'driving' ? '時間為 OSRM 開車路網估計，不含即時路況。' : '時間為 OSRM 步行路網估計。',
  }
}

async function transitRoute(points: RoutePoint[], options: RouteOptions): Promise<Partial<DayRoute>> {
  const transitous = await transitousRoute(points, options)
  const failed = transitous.legs?.some(leg => leg.error) ?? true
  if (!failed) return transitous
  if (options.googleKey) {
    try {
      return await googleTransitRoute(points, options)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Google 大眾運輸失敗。'
      return {
        ...transitous,
        error: `${transitous.error ? `${transitous.error} ` : ''}${reason}`,
      }
    }
  }
  return {
    ...transitous,
    error: transitous.error || '大眾運輸路線無法取得。可改開車或步行，或在設定貼上 Google Maps 金鑰後再試。',
  }
}

async function transitousRoute(points: RoutePoint[], options: RouteOptions): Promise<Partial<DayRoute>> {
  const legs: RouteLeg[] = []
  const geometry: Array<[number, number]> = []
  let departure = departureInstant(options.date, options.timeZone)
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (!from || !to) continue
    try {
      const planned = await transitousLeg(from, to, departure)
      legs.push(planned.leg)
      geometry.push(...planned.geometry)
      if (planned.end) departure = planned.end
    } catch (error) {
      legs.push({
        fromName: from.name,
        toName: to.name,
        distanceMeters: null,
        durationSeconds: null,
        error: error instanceof Error ? error.message : '這段大眾運輸無法計算。',
      })
    }
  }
  const totals = combineLegs(legs)
  const zoneNote = options.timeZone ? options.timeZone : '本機時區'
  return {
    source: 'transitous',
    legs,
    geometry,
    distanceMeters: totals.distanceMeters,
    durationSeconds: totals.durationSeconds,
    departureNote: options.date
      ? `大眾運輸以當天 09:00（${zoneNote}）從起點試算，景點之間不含停留時間。資料來源：Transitous。`
      : `這一天沒有日期，大眾運輸以現在時刻試算。資料來源：Transitous。`,
    error: legs.some(leg => leg.error) ? '有路段沒有大眾運輸結果，全程時間不合計。' : undefined,
  }
}

async function transitousLeg(
  from: RoutePoint,
  to: RoutePoint,
  departure: Date,
): Promise<{ leg: RouteLeg; geometry: Array<[number, number]>; end?: Date }> {
  const params = new URLSearchParams({
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    numItineraries: '1',
    time: departure.toISOString(),
  })
  let response: Response
  try {
    response = await fetch(`https://api.transitous.org/api/v6/plan?${params}`)
  } catch {
    throw new Error('大眾運輸服務（Transitous）暫時無法連線。')
  }
  if (!response.ok) throw new Error(`Transitous 無法計算這段路線（HTTP ${response.status}）。`)
  const data = (await response.json()) as {
    itineraries?: Array<{
      duration?: number
      endTime?: string
      legs?: Array<{
        mode?: string
        duration?: number
        distance?: number
        headsign?: string
        routeShortName?: string
        from?: { name?: string }
        to?: { name?: string }
        legGeometry?: { points?: string; precision?: number }
      }>
    }>
  }
  const itinerary = data.itineraries?.[0]
  if (!itinerary) throw new Error('Transitous 沒有這段大眾運輸路線。')
  const geometry: Array<[number, number]> = []
  const summary = (itinerary.legs ?? [])
    .map(leg => {
      if (leg.legGeometry?.points) {
        geometry.push(...decodePolyline(leg.legGeometry.points, leg.legGeometry.precision ?? 6))
      }
      return transitSummary(leg.mode, leg.routeShortName, leg.headsign)
    })
    .filter(Boolean)
    .join(' → ')
  const distance = (itinerary.legs ?? []).every(leg => typeof leg.distance === 'number')
    ? (itinerary.legs ?? []).reduce((sum, leg) => sum + (leg.distance ?? 0), 0)
    : null
  return {
    leg: {
      fromName: from.name,
      toName: to.name,
      distanceMeters: distance,
      durationSeconds: typeof itinerary.duration === 'number' ? itinerary.duration : null,
      summary: summary || undefined,
    },
    geometry,
    end: itinerary.endTime ? new Date(itinerary.endTime) : undefined,
  }
}

async function googleTransitRoute(points: RoutePoint[], options: RouteOptions): Promise<Partial<DayRoute>> {
  const legs: RouteLeg[] = []
  const geometry: Array<[number, number]> = []
  let departure = departureInstant(options.date, options.timeZone)
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (!from || !to || !options.googleKey) continue
    const planned = await googleTransitLeg(from, to, departure, options.googleKey)
    legs.push(planned.leg)
    geometry.push(...planned.geometry)
    if (planned.leg.durationSeconds != null) departure = new Date(departure.getTime() + planned.leg.durationSeconds * 1000)
  }
  const totals = combineLegs(legs)
  return {
    source: 'google',
    legs,
    geometry,
    distanceMeters: totals.distanceMeters,
    durationSeconds: totals.durationSeconds,
    departureNote: '大眾運輸改由 Google 路線計算。景點之間不含停留時間。',
  }
}

function transitSummary(mode?: string, line?: string, headsign?: string): string {
  const labels: Record<string, string> = {
    WALK: '步行',
    BUS: '公車',
    SUBWAY: '捷運',
    TRAM: '輕軌',
    RAIL: '火車',
    HIGHSPEED_RAIL: '高鐵',
    REGIONAL_RAIL: '區間列車',
    COACH: '客運',
    FERRY: '渡輪',
    AIRPLANE: '飛機',
  }
  const name = mode ? labels[mode] || mode : ''
  return [name, line, headsign].filter(Boolean).join(' ')
}

function departureInstant(date: string | undefined, timeZone: string | undefined): Date {
  if (!date) return new Date()
  if (!timeZone) return new Date(`${date}T09:00:00`)
  return zonedWallTime(date, '09:00', timeZone)
}

export function zonedWallTime(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(utc))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]),
    )
    const seen = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0)
    utc += desired - seen
  }
  return new Date(utc)
}
