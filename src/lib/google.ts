import type { HoursData, HoursPeriod, RouteLeg } from '@/types'

type GooglePeriodPoint = { day?: number; time?: string; hour?: number; minute?: number }

type LegacyOpeningHours = {
  weekday_text?: string[]
  periods?: Array<{ open?: GooglePeriodPoint; close?: GooglePeriodPoint }>
}

type GooglePlaceResult = {
  opening_hours?: LegacyOpeningHours
  photos?: Array<{ getUrl?: (opts: { maxWidth: number }) => string }>
}

type GoogleMapsNamespace = {
  maps: {
    places: { PlacesService: new (el: HTMLElement) => PlacesService }
    TravelMode: { TRANSIT: string }
    DirectionsService: new () => DirectionsService
    LatLng: new (lat: number, lng: number) => unknown
  }
}

type PlacesService = {
  findPlaceFromQuery: (
    request: { query: string; fields: string[]; locationBias?: unknown },
    callback: (results: Array<{ place_id?: string }> | null, status: string) => void,
  ) => void
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (result: GooglePlaceResult | null, status: string) => void,
  ) => void
}

type DirectionsService = {
  route: (
    request: unknown,
    callback: (result: GoogleDirections | null, status: string) => void,
  ) => void
}

type GoogleDirections = {
  routes?: Array<{
    overview_path?: Array<{ lat: () => number; lng: () => number }>
    legs?: Array<{
      distance?: { value?: number }
      duration?: { value?: number }
      steps?: Array<{
        travel_mode?: string
        instructions?: string
        transit?: { line?: { short_name?: string; name?: string } }
      }>
    }>
  }>
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace
  }
}

let pending: Promise<void> | null = null
let loadedKey: string | null = null

export function loadGoogleMaps(key: string): Promise<void> {
  if (!key.trim()) return Promise.reject(new Error('尚未貼上 Google 金鑰。'))
  if (window.google?.maps?.places && loadedKey === key) return Promise.resolve()
  if (loadedKey && loadedKey !== key) {
    return Promise.reject(new Error('已載入另一組金鑰。請重新整理頁面後再更換。'))
  }
  if (pending) return pending
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=zh-TW`
    script.async = true
    script.onload = () => {
      loadedKey = key
      resolve()
    }
    script.onerror = () => {
      pending = null
      reject(new Error('無法載入 Google Maps。請確認金鑰與網路。'))
    }
    document.head.appendChild(script)
  })
  return pending
}

export async function lookupGoogleHours(
  name: string,
  lat: number | undefined,
  lng: number | undefined,
  apiKey: string,
): Promise<{ hours: HoursData; photoUrl?: string }> {
  await loadGoogleMaps(apiKey)
  const maps = window.google?.maps
  if (!maps?.places) throw new Error('Google Places 沒有載入。')
  const service = new maps.places.PlacesService(document.createElement('div'))
  const placeId = await findPlaceId(service, name, lat, lng)
  if (!placeId) throw new Error('Google 找不到相符的地點。')
  const details = await placeDetails(service, placeId)
  const hours = normalizeHours(details.opening_hours)
  if (!hours) throw new Error('Google 沒有回傳可讀的營業時間。')
  const photoUrl = googlePhotoUrl(details)
  return { hours, photoUrl }
}

export async function googleTransitLeg(
  from: { name: string; lat: number; lng: number },
  to: { name: string; lat: number; lng: number },
  departure: Date,
  apiKey: string,
): Promise<{ leg: RouteLeg; geometry: Array<[number, number]> }> {
  await loadGoogleMaps(apiKey)
  const maps = window.google?.maps
  if (!maps) throw new Error('Google Maps 沒有載入。')
  const service = new maps.DirectionsService()
  const result = await new Promise<GoogleDirections>((resolve, reject) => {
    service.route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: maps.TravelMode.TRANSIT,
        transitOptions: { departureTime: departure },
        language: 'zh-TW',
      },
      (response, status) => {
        if (status === 'OK' && response?.routes?.[0]) resolve(response)
        else reject(new Error(googleStatusMessage(status)))
      },
    )
  })
  const route = result.routes?.[0]
  const leg = route?.legs?.[0]
  if (!leg) throw new Error('Google 沒有回傳這段大眾運輸路線。')
  const summary = (leg.steps ?? [])
    .map(step => {
      const line = step.transit?.line?.short_name || step.transit?.line?.name
      if (line) return line
      if (step.travel_mode === 'WALKING') return '步行'
      return step.travel_mode || ''
    })
    .filter(Boolean)
    .join(' → ')
  return {
    leg: {
      fromName: from.name,
      toName: to.name,
      distanceMeters: typeof leg.distance?.value === 'number' ? leg.distance.value : null,
      durationSeconds: typeof leg.duration?.value === 'number' ? leg.duration.value : null,
      summary: summary || undefined,
    },
    geometry: (route?.overview_path ?? []).map(point => [point.lat(), point.lng()] as [number, number]),
  }
}

function findPlaceId(service: PlacesService, name: string, lat?: number, lng?: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    service.findPlaceFromQuery(
      {
        query: name,
        fields: ['place_id'],
        locationBias: lat != null && lng != null ? { center: { lat, lng }, radius: 2000 } : undefined,
      },
      (results, status) => {
        if (status === 'OK') resolve(results?.[0]?.place_id ?? null)
        else if (status === 'ZERO_RESULTS') resolve(null)
        else reject(new Error(googleStatusMessage(status)))
      },
    )
  })
}

function placeDetails(service: PlacesService, placeId: string): Promise<GooglePlaceResult> {
  return new Promise((resolve, reject) => {
    service.getDetails({ placeId, fields: ['opening_hours', 'photos'] }, (result, status) => {
      if (status === 'OK' && result) resolve(result)
      else reject(new Error(googleStatusMessage(status)))
    })
  })
}

function normalizeHours(opening: LegacyOpeningHours | undefined): HoursData | null {
  if (!opening) return null
  const periods: HoursPeriod[] = []
  for (const period of opening.periods ?? []) {
    if (!period.open || period.open.day == null) return { source: 'google', weekdayText: opening.weekday_text }
    const openTime = pointTime(period.open)
    if (!openTime) return { source: 'google', weekdayText: opening.weekday_text }
    if (!period.close) {
      periods.push({ open: { day: period.open.day, time: openTime } })
      continue
    }
    if (period.close.day == null) return { source: 'google', weekdayText: opening.weekday_text }
    const closeTime = pointTime(period.close)
    if (!closeTime) return { source: 'google', weekdayText: opening.weekday_text }
    periods.push({
      open: { day: period.open.day, time: openTime },
      close: { day: period.close.day, time: closeTime },
    })
  }
  if (!periods.length && !opening.weekday_text?.length) return null
  return { source: 'google', weekdayText: opening.weekday_text, periods: periods.length ? periods : undefined }
}

function pointTime(point: GooglePeriodPoint): string | null {
  if (typeof point.time === 'string' && /^\d{3,4}$/.test(point.time)) return point.time.padStart(4, '0')
  if (typeof point.hour === 'number' && typeof point.minute === 'number') {
    return `${String(point.hour).padStart(2, '0')}${String(point.minute).padStart(2, '0')}`
  }
  return null
}

function googlePhotoUrl(details: GooglePlaceResult): string | undefined {
  try {
    const url = details.photos?.[0]?.getUrl?.({ maxWidth: 800 })
    if (!url || /key=/i.test(url)) return undefined
    return url
  } catch {
    return undefined
  }
}

function googleStatusMessage(status: string): string {
  if (status === 'REQUEST_DENIED') return 'Google 拒絕這組金鑰（REQUEST_DENIED）。請確認已啟用 Maps JavaScript、Places 與 Directions。'
  if (status === 'OVER_QUERY_LIMIT') return 'Google 配額已用完（OVER_QUERY_LIMIT）。'
  if (status === 'ZERO_RESULTS') return 'Google 沒有這段路線或地點（ZERO_RESULTS）。'
  return `Google 沒有回傳結果（${status || '未知狀態'}）。`
}
