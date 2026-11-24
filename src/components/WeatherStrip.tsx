import { useEffect, useState } from 'react'
import { searchNominatim } from '@/lib/nominatim'
import { fetchWeather, type WeatherReport } from '@/lib/weather'
import { formatShortDate } from '@/lib/format'
import { useStore } from '@/store'
import type { Trip } from '@/types'

export function WeatherStrip({ trip, onReport }: { trip: Trip; onReport: (report: WeatherReport | null) => void }) {
  const store = useStore()
  const [report, setReport] = useState<WeatherReport | null>(null)
  const [status, setStatus] = useState('正在查天氣…')
  const [placeLabel, setPlaceLabel] = useState('')
  const point = firstPoint(trip)
  const rangeStart = trip.startDate || trip.days.find(day => day.date)?.date
  const rangeEnd = trip.endDate || [...trip.days].reverse().find(day => day.date)?.date

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus('正在查天氣…')
        try {
          const located = await locate(trip.destination, point)
          if (cancelled) return
          if (!located) {
            const empty = { days: [], error: trip.destination ? `找不到「${trip.destination}」的座標，無法查天氣。` : '需要目的地或行程座標才能查天氣。' }
            setReport(empty)
            onReport(empty)
            setStatus('')
            setPlaceLabel('')
            return
          }
          setPlaceLabel(located.label)
          const next = await fetchWeather(located.lat, located.lng, rangeStart, rangeEnd && rangeStart ? rangeEnd : undefined)
          if (cancelled) return
          setReport(next)
          onReport(next)
          setStatus('')
          if (next.timezone && next.timezone !== trip.timezone) store.updateTrip(trip.id, { timezone: next.timezone })
        } catch (error) {
          if (cancelled) return
          const failed = { days: [], error: error instanceof Error ? error.message : '無法取得天氣。' }
          setReport(failed)
          onReport(failed)
          setStatus('')
        }
      })()
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trip.destination, trip.id, point?.lat, point?.lng, rangeStart, rangeEnd])

  return (
    <section className="rounded-xl border bg-card p-3" aria-live="polite">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">天氣</h2>
        {placeLabel ? <p className="text-xs text-muted-foreground">位置：{placeLabel}{report?.timezone ? ` · ${report.timezone}` : ''}</p> : null}
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {report?.error ? <p className="rounded-lg bg-warn-bg px-2 py-1.5 text-sm text-warn">{report.error}</p> : null}
      {report && !report.error && report.days.length ? (
        <ul className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
          {report.days.map(day => (
            <li key={day.date} className="min-w-28 rounded-lg bg-muted px-2 py-1.5 text-xs">
              <p className="font-medium">{formatShortDate(day.date)}</p>
              <p>{day.label || (day.code != null ? `代碼 ${day.code}` : '無代碼')}</p>
              <p>{day.tempMin != null && day.tempMax != null ? `${day.tempMin}–${day.tempMax}°C` : '溫度未提供'}</p>
              <p>{day.precipProbability != null ? `降雨 ${day.precipProbability}%` : '降雨未提供'}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

async function locate(destination: string, point: { lat: number; lng: number; label: string } | null) {
  if (destination.trim()) {
    const hits = await searchNominatim(destination.trim())
    const hit = hits[0]
    if (!hit) return null
    return { lat: Number(hit.lat), lng: Number(hit.lon), label: destination.trim() }
  }
  return point ? { ...point, label: `${point.label}（行程座標）` } : null
}

function firstPoint(trip: Trip): { lat: number; lng: number; label: string } | null {
  for (const day of trip.days) {
    if (day.hotel?.lat != null && day.hotel.lng != null) return { lat: day.hotel.lat, lng: day.hotel.lng, label: day.hotel.name }
    for (const stop of day.stops) {
      if (stop.place.lat != null && stop.place.lng != null) return { lat: stop.place.lat, lng: stop.place.lng, label: stop.place.name }
    }
  }
  return null
}
