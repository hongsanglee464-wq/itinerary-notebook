import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { normalizeTrip } from '@/lib/tripModel'
import type { Trip } from '@/types'

export function encodeTripHash(trip: Trip): string {
  const slim: Trip = {
    ...trip,
    days: trip.days.map(day => ({ ...day, route: undefined })),
  }
  return `#t=${compressToEncodedURIComponent(JSON.stringify({ v: 1, trip: slim }))}`
}

export function decodeTripHash(hash: string): Trip | null {
  const payload = hash.startsWith('#') ? hash.slice(1) : hash
  const encoded = payload.startsWith('t=') ? payload.slice(2) : payload
  if (!encoded) return null
  const json = decompressFromEncodedURIComponent(encoded)
  if (!json) return null
  try {
    return normalizeTrip(JSON.parse(json))
  } catch {
    return null
  }
}

export function exportTripJson(trip: Trip): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), trip }, null, 2)
}
