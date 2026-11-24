export type ParsedMapLink = {
  name?: string
  lat?: number
  lng?: number
  osm?: { type: 'N' | 'W' | 'R'; id: string }
}

const GENERIC_TITLE =
  /^(google maps|google 地圖|openstreetmap|apple maps|maps|地圖|untitled|無標題)$/i

export function looksLikeUrl(value: string): boolean {
  return /^(https?:\/\/|geo:)/i.test(value.trim())
}

export function parseLatLngPair(value: string): { lat: number; lng: number } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function cleanTitle(title: string | undefined): string | undefined {
  if (!title) return undefined
  const trimmed = title.replace(/\s+/g, ' ').trim()
  if (!trimmed || GENERIC_TITLE.test(trimmed)) return undefined
  const soft = trimmed.split(/\s+[-–—|｜]\s+/)[0]?.trim() || trimmed
  const hard = soft.split(/[-–—|｜]/)[0]?.trim() || soft
  const chosen = hard.length >= 2 && hard.length < soft.length ? hard : soft
  if (!chosen || GENERIC_TITLE.test(chosen)) return undefined
  return chosen
}

export function parseMapLink(input: string): ParsedMapLink {
  const trimmed = input.trim()
  if (trimmed.toLowerCase().startsWith('geo:')) return parseGeo(trimmed)
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return {}
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'maps.apple.com') return parseApple(url)
  if (host.includes('openstreetmap.org') || host === 'osm.org') return parseOsm(url)
  if (host.includes('google.') || host.includes('goo.gl') || host.endsWith('maps.app')) return parseGoogle(url)
  return {}
}

function parseGeo(value: string): ParsedMapLink {
  const match = value.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\?([^#]*))?/i)
  if (!match) return {}
  const result: ParsedMapLink = {}
  assignCoord(result, Number(match[1]), Number(match[2]))
  const params = new URLSearchParams(match[3] ?? '')
  const name = cleanTitle(params.get('q') ?? undefined)
  if (name && !parseLatLngPair(name)) result.name = name
  return result
}

function parseApple(url: URL): ParsedMapLink {
  const result: ParsedMapLink = {}
  const ll = url.searchParams.get('ll')
  const pair = ll ? parseLatLngPair(ll) : null
  if (pair) assignCoord(result, pair.lat, pair.lng)
  const name = cleanTitle(url.searchParams.get('q') ?? url.searchParams.get('address') ?? undefined)
  if (name && !parseLatLngPair(name)) result.name = name
  return result
}

function parseOsm(url: URL): ParsedMapLink {
  const result: ParsedMapLink = {}
  const object = url.pathname.match(/\/(node|way|relation)\/(\d+)/)
  if (object) {
    const type = object[1] === 'node' ? 'N' : object[1] === 'way' ? 'W' : 'R'
    result.osm = { type, id: object[2] }
  }
  const mlat = url.searchParams.get('mlat')
  const mlon = url.searchParams.get('mlon')
  if (mlat && mlon) assignCoord(result, Number(mlat), Number(mlon))
  const hash = url.hash.match(/map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/)
  if (hash && result.lat == null) assignCoord(result, Number(hash[1]), Number(hash[2]))
  return result
}

function parseGoogle(url: URL): ParsedMapLink {
  const result: ParsedMapLink = {}
  const preciseLat = url.href.match(/!3d(-?\d+(?:\.\d+)?)/)
  const preciseLng = url.href.match(/!4d(-?\d+(?:\.\d+)?)/)
  const camera = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (preciseLat && preciseLng) assignCoord(result, Number(preciseLat[1]), Number(preciseLng[1]))
  else if (camera) assignCoord(result, Number(camera[1]), Number(camera[2]))

  const place = url.pathname.match(/\/maps\/place\/([^/]+)/)
  const search = url.pathname.match(/\/maps\/search\/([^/]+)/)
  const rawName = place?.[1] && !place[1].startsWith('@') ? place[1] : search?.[1]
  const pathName = rawName ? cleanTitle(decodeMapText(rawName)) : undefined
  if (pathName && !parseLatLngPair(pathName)) result.name = pathName

  const query = url.searchParams.get('query') || url.searchParams.get('q')
  if (query) {
    const pair = parseLatLngPair(query)
    if (pair && result.lat == null) assignCoord(result, pair.lat, pair.lng)
    else if (!pair && !result.name) {
      const name = cleanTitle(query)
      if (name) result.name = name
    }
  }
  return result
}

function decodeMapText(value: string): string {
  const spaced = value.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(spaced)
  } catch {
    return spaced
  }
}

function assignCoord(target: ParsedMapLink, lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return
  target.lat = lat
  target.lng = lng
}
