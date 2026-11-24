import type { NominatimHit } from '@/lib/nominatim'
import { isUsablePhotoUrl } from '@/lib/photoUrl'
import type { PlacePhoto } from '@/types'

export async function photosForHit(hit: NominatimHit): Promise<PlacePhoto[]> {
  const photos: PlacePhoto[] = []
  const extra = hit.extratags ?? {}
  const osmUrl = osmImageUrl(extra.image || extra.wikimedia_commons)
  if (osmUrl && isUsablePhotoUrl(osmUrl)) photos.push({ url: osmUrl, source: 'osm' })
  if (extra.wikipedia) {
    const thumb = await wikipediaThumb(extra.wikipedia)
    if (thumb && isUsablePhotoUrl(thumb)) photos.push({ url: thumb, source: 'wikimedia' })
  }
  if (extra.wikidata) {
    const photo = await wikidataPhoto(extra.wikidata)
    if (photo && isUsablePhotoUrl(photo)) photos.push({ url: photo, source: 'wikimedia' })
  }
  return photos
}

export async function wikidataSearchPhoto(name: string): Promise<PlacePhoto | null> {
  const language = /[A-Za-z]/.test(name) && !/[\u4e00-\u9fff]/.test(name) ? 'en' : 'zh'
  const data = await readJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=${language}&format=json&origin=*&limit=5`,
  )
  const entities = asRecord(data)?.search
  if (!Array.isArray(entities)) return null
  for (const entity of entities) {
    const record = asRecord(entity)
    const label = typeof record?.label === 'string' ? record.label : ''
    const id = typeof record?.id === 'string' ? record.id : ''
    if (!id || !strongLabel(name, label)) continue
    const photo = await wikidataPhoto(id)
    if (photo && isUsablePhotoUrl(photo)) return { url: photo, source: 'wikimedia' }
  }
  return null
}

export function osmImageUrl(value: string | undefined): string | null {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  const file = value.replace(/^File:/i, '').trim()
  if (!file.includes('.')) return null
  return commonsFileUrl(file)
}

export function commonsFileUrl(filename: string): string {
  const normalized = filename.replace(/^File:/i, '').trim().replace(/ /g, '_')
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}?width=960`
}

async function wikipediaThumb(tag: string): Promise<string | null> {
  const match = tag.match(/^([a-z]{2,3}):(.+)$/i)
  if (!match) return null
  const lang = match[1].toLowerCase()
  const title = match[2].replace(/ /g, '_')
  const data = await readJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(title)}&pithumbsize=960&format=json&origin=*`,
  )
  const pages = asRecord(asRecord(asRecord(data)?.query)?.pages)
  if (!pages) return null
  for (const page of Object.values(pages)) {
    const source = asRecord(asRecord(page)?.thumbnail)?.source
    if (typeof source === 'string') return source
  }
  return null
}

async function wikidataPhoto(qid: string): Promise<string | null> {
  if (!/^Q\d+$/.test(qid)) return null
  const data = await readJson(
    `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(qid)}&property=P18&format=json&origin=*`,
  )
  const claims = asRecord(asRecord(data)?.claims)?.P18
  const first = Array.isArray(claims) ? asRecord(claims[0]) : null
  const filename = asRecord(asRecord(first)?.mainsnak)?.datavalue
  const value = asRecord(filename)?.value
  if (typeof value !== 'string' || !value.trim()) return null
  return commonsFileUrl(value)
}

function strongLabel(query: string, label: string): boolean {
  const a = query.toLowerCase().replace(/\s+/g, '')
  const b = label.toLowerCase().replace(/\s+/g, '')
  if (!a || !b) return false
  if (a === b) return true
  const shorter = a.length < b.length ? a : b
  const longer = a.length < b.length ? b : a
  return longer.includes(shorter) && shorter.length / longer.length >= 0.7
}

async function readJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}
