export type NominatimHit = {
  name?: string
  display_name: string
  lat: string
  lon: string
  osm_type?: string
  osm_id?: number
  category?: string
  type?: string
  address?: Record<string, string>
  extratags?: Record<string, string>
}

const BASE = 'https://nominatim.openstreetmap.org'

let tail: Promise<void> = Promise.resolve()
let lastAt = 0

function pace(): Promise<void> {
  const run = tail.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastAt))
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    lastAt = Date.now()
  })
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function nominatim(path: string): Promise<unknown> {
  await pace()
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Accept-Language': 'zh-TW,zh-Hant;q=0.9,zh;q=0.8,en;q=0.5' },
    })
  } catch {
    throw new Error('地名服務暫時無法連線，請稍後再試。')
  }
  if (!response.ok) throw new Error(`地名服務暫時無法使用（HTTP ${response.status}）。`)
  return response.json()
}

export async function searchNominatim(query: string): Promise<NominatimHit[]> {
  const data = await nominatim(
    `/search?format=jsonv2&addressdetails=1&extratags=1&limit=5&q=${encodeURIComponent(query)}`,
  )
  return Array.isArray(data) ? (data as NominatimHit[]) : []
}

export async function lookupOsm(type: 'N' | 'W' | 'R', id: string): Promise<NominatimHit | null> {
  const data = await nominatim(
    `/lookup?format=jsonv2&addressdetails=1&extratags=1&osm_ids=${type}${encodeURIComponent(id)}`,
  )
  return Array.isArray(data) && data[0] ? (data[0] as NominatimHit) : null
}
