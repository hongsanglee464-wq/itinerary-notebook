import { categoryLabel, pickNearest, shortAddress } from '@/lib/geo'
import { photosForHit, wikidataSearchPhoto } from '@/lib/images'
import { cleanTitle, looksLikeUrl, parseMapLink } from '@/lib/mapLinks'
import { lookupOsm, searchNominatim, type NominatimHit } from '@/lib/nominatim'
import { isUsablePhotoUrl, orderPhotos } from '@/lib/photoUrl'
import { createId } from '@/lib/id'
import type { Place, PlacePhoto } from '@/types'

export async function findPlaces(input: string): Promise<Place[]> {
  const query = input.trim()
  if (!query) throw new Error('請輸入地名或貼上連結。')
  if (looksLikeUrl(query)) return [await identifyFromLink(query)]
  const hits = await searchNominatim(query)
  if (!hits.length) throw new Error('找不到這個地名。可以換個寫法，或貼上地圖連結。')
  return Promise.all(hits.slice(0, 5).map(hit => placeFromHit(hit)))
}

export async function placeFromHit(hit: NominatimHit, extraPhotos: PlacePhoto[] = []): Promise<Place> {
  const hoursRaw = hit.extratags?.opening_hours?.trim()
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  const photos = orderPhotos([...(await photosForHit(hit)), ...extraPhotos])
  return {
    id: createId(),
    name: hit.name?.trim() || hit.display_name.split(',')[0]?.trim() || '未命名地點',
    address: shortAddress(hit.address, hit.display_name),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    countryCode: hit.address?.country_code?.toLowerCase(),
    photos,
    hours: hoursRaw ? { source: 'osm', osm: hoursRaw } : undefined,
    hoursChecked: true,
    category: categoryLabel(hit.type),
  }
}

async function identifyFromLink(raw: string): Promise<Place> {
  const preview = await fetchLinkPreview(raw)
  const finalUrl = preview.finalUrl || raw
  const parsed = mergeParsed(parseMapLink(finalUrl), parseMapLink(raw))
  const titleName = cleanTitle(preview.title)
  let hit: NominatimHit | null = null
  if (parsed.osm) hit = await lookupOsm(parsed.osm.type, parsed.osm.id)
  const name = parsed.name || titleName
  if (!hit && name) {
    const hits = await searchNominatim(name)
    hit = pickNominatim(hits, { name, lat: parsed.lat, lng: parsed.lng })
  }
  const ogPhoto =
    preview.imageUrl && isUsablePhotoUrl(preview.imageUrl)
      ? [{ url: preview.imageUrl, source: 'open-graph' as const }]
      : []

  let place: Place
  if (hit) {
    place = await placeFromHit(hit, ogPhoto)
    if (parsed.lat != null && parsed.lng != null && place.lat != null && place.lng != null) {
      const distance = distanceMeters(parsed.lat, parsed.lng, place.lat, place.lng)
      if (distance > 1200) {
        place = unmatchedPlace(name || place.name, parsed.lat, parsed.lng, finalUrl, ogPhoto)
      }
    }
  } else if (name || parsed.lat != null) {
    place = unmatchedPlace(name || '未命名地點', parsed.lat, parsed.lng, finalUrl, ogPhoto)
  } else {
    throw new Error('沒辦法從這個連結辨認地點。可以改貼含有地名的網址，或直接輸入名稱。')
  }

  if (parsed.name && (!place.name || place.name === '未命名地點')) place = { ...place, name: parsed.name }
  place = { ...place, sourceUrl: finalUrl, photos: orderPhotos([...ogPhoto, ...place.photos]) }
  if (place.lat == null && parsed.lat != null && parsed.lng != null) {
    place = { ...place, lat: parsed.lat, lng: parsed.lng }
  }
  if (!place.photos.length && place.name && place.name !== '未命名地點') {
    const searched = await wikidataSearchPhoto(place.name)
    if (searched) place = { ...place, photos: [searched] }
  }
  return place
}

function unmatchedPlace(
  name: string,
  lat: number | undefined,
  lng: number | undefined,
  sourceUrl: string,
  photos: PlacePhoto[],
): Place {
  return {
    id: createId(),
    name,
    lat,
    lng,
    sourceUrl,
    photos: orderPhotos(photos),
    hoursChecked: true,
  }
}

function pickNominatim(
  hits: NominatimHit[],
  hint: { name?: string; lat?: number; lng?: number },
): NominatimHit | null {
  const located = hits.flatMap(hit => {
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return [{ hit, lat, lng, name: hit.name }]
  })
  return pickNearest(located, hint)?.hit ?? null
}

function mergeParsed(
  primary: ReturnType<typeof parseMapLink>,
  secondary: ReturnType<typeof parseMapLink>,
): ReturnType<typeof parseMapLink> {
  return {
    name: primary.name || secondary.name,
    lat: primary.lat ?? secondary.lat,
    lng: primary.lng ?? secondary.lng,
    osm: primary.osm || secondary.osm,
  }
}

async function fetchLinkPreview(raw: string): Promise<{ finalUrl?: string; title?: string; imageUrl?: string }> {
  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(raw)}`)
    if (!response.ok) return {}
    const data = (await response.json()) as { finalUrl?: string; title?: string; imageUrl?: string | null }
    return {
      finalUrl: data.finalUrl,
      title: data.title,
      imageUrl: data.imageUrl || undefined,
    }
  } catch {
    return {}
  }
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earth = 6371000
  const r1 = (lat1 * Math.PI) / 180
  const r2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}
