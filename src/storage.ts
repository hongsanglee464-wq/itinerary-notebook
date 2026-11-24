import { emptyAppData, normalizeTrip } from '@/lib/tripModel'
import type { AppData } from '@/types'

const KEY = 'itinerary-notebook-v1'

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyAppData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    const trips = Array.isArray(parsed.trips) ? parsed.trips.map(trip => normalizeTrip(trip)).filter(trip => trip != null) : []
    const activeTripId = trips.some(trip => trip.id === parsed.activeTripId) ? parsed.activeTripId : trips[0]?.id
    return {
      version: 1,
      trips,
      activeTripId,
      googleMapsKey: typeof parsed.googleMapsKey === 'string' ? parsed.googleMapsKey : undefined,
    }
  } catch {
    return emptyAppData()
  }
}

export function saveAppData(data: AppData) {
  const payload: AppData = {
    version: 1,
    trips: data.trips,
    activeTripId: data.activeTripId,
    googleMapsKey: data.googleMapsKey,
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
}
