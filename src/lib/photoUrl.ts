type PhotoSource = 'open-graph' | 'wikimedia' | 'osm'

type PlacePhoto = {
  url: string
  source: PhotoSource
}

const JUNK =
  /(favicon|apple-touch-icon|sprite|loader|spinner|spacer|pixel|1x1|badge|tracking|analytics|staticmap|maps\/api\/staticmap|maps\.googleapis\.com\/maps\/api|key=AIza)/i

const LOGO = /(logo|wordmark|emblem|coat_of_arms|\.svg(?:$|\?))/i

export function isUsablePhotoUrl(value: string | undefined | null): value is string {
  if (!value) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (JUNK.test(url.href)) return false
  return true
}

export function looksLikeLogo(url: string): boolean {
  return LOGO.test(url)
}

export function orderPhotos(photos: PlacePhoto[]): PlacePhoto[] {
  const unique = photos.filter((photo, index) => photos.findIndex(item => item.url === photo.url) === index)
  return unique
    .filter(photo => isUsablePhotoUrl(photo.url))
    .sort((a, b) => photoScore(b) - photoScore(a))
}

function photoScore(photo: PlacePhoto): number {
  const sourceScore: Record<PhotoSource, number> = {
    'open-graph': 30,
    wikimedia: 22,
    osm: 20,
  }
  return sourceScore[photo.source] - (looksLikeLogo(photo.url) ? 24 : 0)
}

export function photoSourceLabel(source: PhotoSource): string {
  if (source === 'open-graph') return '頁面預覽'
  if (source === 'wikimedia') return 'Wikimedia'
  return 'OpenStreetMap'
}
