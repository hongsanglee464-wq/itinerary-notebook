import { describe, expect, it } from 'vitest'
import { summarizeBudget } from '@/lib/budget'
import { formatDistance, formatDuration } from '@/lib/format'
import { googleAt, judgeHours } from '@/lib/hours'
import { cleanTitle, parseMapLink } from '@/lib/mapLinks'
import { isUsablePhotoUrl, orderPhotos } from '@/lib/photoUrl'
import { decodePolyline } from '@/lib/polyline'
import { extractPreview, isBlockedRequestUrl } from '@/lib/previewHtml.ts'
import { combineLegs, osrmEndpoint } from '@/lib/routing'
import { decodeTripHash, encodeTripHash } from '@/lib/share'
import { createTrip, normalizeTrip } from '@/lib/tripModel'
import type { Place, Trip } from '@/types'

const museum: Place = {
  id: 'p1',
  name: '國立故宮博物院',
  lat: 25.102,
  lng: 121.548,
  countryCode: 'tw',
  photos: [],
  hours: { source: 'osm', osm: 'Tu-Su 09:00-17:00' },
  hoursChecked: true,
}

describe('map links', () => {
  it('reads a Google Maps place pin and name', () => {
    const parsed = parseMapLink(
      'https://www.google.com/maps/place/%E5%8F%B0%E5%8C%97101/@25.0340,121.5600,17z/data=!3d25.033964!4d121.564468',
    )
    expect(parsed.name).toBe('台北101')
    expect(parsed.lat).toBeCloseTo(25.033964)
    expect(parsed.lng).toBeCloseTo(121.564468)
  })

  it('reads Apple Maps, OSM and geo links', () => {
    expect(parseMapLink('https://maps.apple.com/?ll=25.03,121.56&q=%E6%95%85%E5%AE%AE').name).toBe('故宮')
    expect(parseMapLink('https://www.openstreetmap.org/way/1159328965').osm).toEqual({ type: 'W', id: '1159328965' })
    expect(parseMapLink('geo:25.1,121.5?q=台北101')).toMatchObject({ lat: 25.1, lng: 121.5, name: '台北101' })
  })

  it('does not treat a plain website as coordinates', () => {
    expect(parseMapLink('https://www.npm.gov.tw/')).toEqual({})
    expect(cleanTitle('國立故宮博物院-北部院區全球資訊網')).toBe('國立故宮博物院')
    expect(cleanTitle('Google Maps')).toBeUndefined()
  })
})

describe('photos', () => {
  it('rejects junk and static map keys, and prefers a real preview', () => {
    expect(isUsablePhotoUrl('https://maps.google.com/maps/api/staticmap?key=AIzaSyExample')).toBe(false)
    expect(isUsablePhotoUrl('https://example.com/loader.gif')).toBe(false)
    expect(isUsablePhotoUrl('https://ws.example.com/taipei.jpg')).toBe(true)
    const ordered = orderPhotos([
      { url: 'https://example.com/logo.svg', source: 'open-graph' },
      { url: 'https://example.com/taipei.jpg', source: 'wikimedia' },
    ])
    expect(ordered[0]?.url).toContain('taipei.jpg')
  })

  it('extracts an Open Graph image and skips a keyed static map', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="台北101 TAIPEI 101" />
        <meta property="og:image" content="https://example.com/photo.jpg?width=800&amp;x=1" />
        <meta property="og:image" content="https://maps.googleapis.com/maps/api/staticmap?key=AIzaSyNope" />
      </head></html>`
    expect(extractPreview(html, 'https://www.taipei-101.com.tw/')).toEqual({
      title: '台北101 TAIPEI 101',
      imageUrl: 'https://example.com/photo.jpg?width=800&x=1',
    })
    expect(isBlockedRequestUrl('http://127.0.0.1/secret')).toBe(true)
    expect(isBlockedRequestUrl('https://www.npm.gov.tw/')).toBe(false)
  })
})

describe('hours', () => {
  it('warns when closed, open, or missing', () => {
    expect(judgeHours(museum, '2026-11-24', '10:00').level).toBe('ok')
    expect(judgeHours(museum, '2026-11-24', '18:30').title).toContain('打烊')
    expect(judgeHours(museum, '2026-11-23', '10:00').title).toContain('不營業')
    expect(judgeHours(museum, '2026-11-24', undefined).title).toContain('預計抵達')
    expect(judgeHours({ ...museum, hours: undefined }, '2026-11-24', '10:00').title).toContain('無法確認')
  })

  it('does not claim a holiday rule it cannot evaluate', () => {
    const place: Place = { ...museum, hours: { source: 'osm', osm: 'Mo-Su 09:00-18:00; PH off' } }
    const result = judgeHours(place, '2026-11-24', '10:00')
    expect(result.level).toBe('warn')
    expect(result.title).toContain('無法判斷')
  })

  it('reads Google periods, including overnight', () => {
    expect(
      googleAt([{ open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }], new Date(2026, 10, 24, 10, 0)),
    ).toBe('open')
    expect(
      googleAt([{ open: { day: 5, time: '1800' }, close: { day: 6, time: '0200' } }], new Date(2026, 10, 28, 1, 0)),
    ).toBe('open')
    expect(googleAt([{ open: { day: 2, time: '0900' }, close: { day: 2, time: '1700' } }], new Date(2026, 10, 24, 18, 0))).toBe(
      'closed',
    )
  })
})

describe('budget, route totals and share', () => {
  it('sums only filled costs, including zero', () => {
    const trip = sampleTrip()
    trip.days[0]?.stops.push(
      { id: 's1', place: museum, bookingStatus: 'booked', cost: 350 },
      { id: 's2', place: museum, bookingStatus: 'paid', cost: 0 },
      { id: 's3', place: museum, bookingStatus: 'not_booked' },
    )
    expect(summarizeBudget(trip)).toEqual({ total: 350, filled: 2, blank: 1 })
  })

  it('does not total a route when any leg failed', () => {
    expect(
      combineLegs([
        { fromName: '住', toName: 'A', distanceMeters: 1000, durationSeconds: 600 },
        { fromName: 'A', toName: 'B', distanceMeters: null, durationSeconds: null, error: '沒有路線' },
      ]),
    ).toEqual({ distanceMeters: null, durationSeconds: null })
    expect(formatDistance(6057.5)).toBe('6.1 公里')
    expect(formatDuration(512)).toBe('約 9 分鐘')
    expect(osrmEndpoint('walking')).toContain('/routed-foot/')
    expect(osrmEndpoint('driving')).toContain('/routed-car/')
    expect(osrmEndpoint('walking')).not.toContain('project-osrm.org')
  })

  it('round-trips a trip through a share hash', () => {
    const trip = sampleTrip()
    const decoded = decodeTripHash(encodeTripHash(trip))
    expect(decoded?.title).toBe(trip.title)
    expect(decoded?.days).toHaveLength(1)
    expect(normalizeTrip({ nope: true })).toBeNull()
  })

  it('decodes a known polyline', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(points[0]?.[0]).toBeCloseTo(38.5)
    expect(points[0]?.[1]).toBeCloseTo(-120.2)
    expect(points[2]?.[0]).toBeCloseTo(43.252)
  })
})

function sampleTrip(): Trip {
  return createTrip({ title: '台北週末', destination: '臺北市', startDate: '2026-11-24', endDate: '2026-11-24', currency: 'TWD' })
}
