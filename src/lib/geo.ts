export type LatLng = { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const earth = 6371000
  const r1 = (a.lat * Math.PI) / 180
  const r2 = (b.lat * Math.PI) / 180
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[\s\u3000·・,，.。'’"“”\-_/()（）]/g, '')
}

export function namesMatch(a: string, b: string): boolean {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  if (left === right) return true
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  if (shorter.length < 2) return false
  return longer.includes(shorter) && shorter.length / longer.length >= 0.6
}

export function pickNearest<T extends LatLng & { name?: string }>(
  hits: T[],
  hint: { lat?: number; lng?: number; name?: string },
): T | null {
  if (!hits.length) return null
  if (hint.lat == null || hint.lng == null) {
    if (!hint.name) return hits[0] ?? null
    return hits.find(hit => hit.name && namesMatch(hint.name!, hit.name)) ?? hits[0] ?? null
  }
  const origin = { lat: hint.lat, lng: hint.lng }
  const nearby = hits
    .map(hit => ({ hit, distance: haversineMeters(origin, hit) }))
    .filter(item => item.distance <= 1200)
    .sort((a, b) => a.distance - b.distance)
  if (!nearby.length) return null
  if (hint.name) {
    const named = nearby.find(item => item.hit.name && namesMatch(hint.name!, item.hit.name))
    if (named) return named.hit
  }
  return nearby[0]?.hit ?? null
}

export function shortAddress(address: Record<string, string> | undefined, fallback?: string): string | undefined {
  if (!address) return fallback
  const city = address.city || address.town || address.village || address.state
  const road = address.road
    ? address.house_number
      ? `${address.road}${address.house_number}號`
      : address.road
    : undefined
  const parts = [road, address.suburb || address.neighbourhood, city, address.country].filter(Boolean)
  return parts.length ? parts.join('，') : fallback
}

const CATEGORIES: Record<string, string> = {
  museum: '博物館',
  attraction: '景點',
  viewpoint: '觀景點',
  hotel: '住宿',
  guest_house: '民宿',
  restaurant: '餐廳',
  cafe: '咖啡',
  fast_food: '小吃',
  place_of_worship: '寺廟／教堂',
  park: '公園',
  garden: '花園',
  station: '車站',
  bus_stop: '公車站',
  mall: '商場',
  marketplace: '市場',
  theatre: '劇場',
  cinema: '電影院',
  zoo: '動物園',
  aquarium: '水族館',
  theme_park: '主題樂園',
  memorial: '紀念地',
  ruins: '遺址',
  castle: '城堡',
  beach: '海灘',
  peak: '山岳',
}

export function categoryLabel(type: string | undefined): string | undefined {
  if (!type) return undefined
  return CATEGORIES[type]
}
