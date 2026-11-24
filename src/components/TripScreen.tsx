import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DayBoard } from '@/components/DayBoard'
import { Wishlist } from '@/components/Wishlist'
import { WeatherStrip } from '@/components/WeatherStrip'
import { summarizeBudget } from '@/lib/budget'
import { renderTripHtml, tripHtmlFilename } from '@/lib/exportHtml'
import { fileSlug, formatDayLabel, formatMoney } from '@/lib/format'
import { encodeTripHash, exportTripJson } from '@/lib/share'
import type { WeatherReport } from '@/lib/weather'
import { useStore } from '@/store'
import { CURRENCIES, type Trip } from '@/types'

export function TripScreen({ trip }: { trip: Trip }) {
  const store = useStore()
  const [activeDayId, setActiveDayId] = useState(trip.days[0]?.id ?? '')
  const [shareMessage, setShareMessage] = useState('')
  const [weather, setWeather] = useState<WeatherReport | null>(null)
  const budget = summarizeBudget(trip)
  const activeDay = trip.days.find(day => day.id === activeDayId) ?? trip.days[0]

  async function copyShare() {
    const url = `${window.location.origin}${window.location.pathname}${encodeTripHash(trip)}`
    const note = url.length > 12000 ? '連結很長，若對方打不開，請改下載 JSON。' : '已複製分享連結。對方用同一份行程筆記打開即可匯入。'
    try {
      await navigator.clipboard.writeText(url)
      setShareMessage(note)
    } catch {
      setShareMessage(url)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            aria-label="行程名稱"
            value={trip.title}
            onChange={event => store.updateTrip(trip.id, { title: event.target.value })}
            className="h-10 text-lg font-semibold"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label="目的地"
              value={trip.destination}
              placeholder="目的地"
              onChange={event => store.updateTrip(trip.id, { destination: event.target.value })}
            />
            <select
              aria-label="幣別"
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              value={trip.currency}
              onChange={event => store.updateTrip(trip.id, { currency: event.target.value })}
            >
              {CURRENCIES.map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="開始日期"
              type="date"
              value={trip.startDate ?? ''}
              onChange={event => store.updateTrip(trip.id, { startDate: event.target.value || undefined })}
              className="w-40"
            />
            <Input
              aria-label="結束日期"
              type="date"
              value={trip.endDate ?? ''}
              onChange={event => store.updateTrip(trip.id, { endDate: event.target.value || undefined })}
              className="w-40"
            />
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => download(`${fileSlug(trip.title)}.json`, exportTripJson(trip), 'application/json')}>
            下載 JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => download(tripHtmlFilename(trip), renderTripHtml(trip, weather), 'text/html')}
          >
            下載 HTML
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyShare()}>
            複製連結
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            列印
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => store.deleteTrip(trip.id)}>
            刪除行程
          </Button>
        </div>
      </div>
      {shareMessage ? <p className="no-print break-all text-xs text-muted-foreground">{shareMessage}</p> : null}
      <section className="rounded-xl border bg-card p-3">
        <p className="text-sm font-medium">花費合計 {formatMoney(budget.total, trip.currency)}</p>
        <p className="text-xs text-muted-foreground">
          {budget.filled} 項已填，{budget.blank} 項未填。未填的不計入，填 0 代表免費。
        </p>
      </section>
      <WeatherStrip trip={trip} onReport={setWeather} />
      <div className="no-print flex min-w-0 max-w-full gap-2 overflow-x-auto">
        {trip.days.map((day, index) => (
          <Button
            key={day.id}
            type="button"
            size="sm"
            variant={day.id === activeDay?.id ? 'default' : 'outline'}
            onClick={() => setActiveDayId(day.id)}
          >
            {formatDayLabel(index, day.date)}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => store.addDay(trip.id)}>
          新增一天
        </Button>
      </div>
      {trip.days.length === 0 ? <p className="text-sm text-muted-foreground">還沒有天數。按「新增一天」開始排。</p> : null}
      {trip.days.map((day, index) => (
        <div key={day.id} className={day.id === activeDay?.id ? '' : 'hidden print:block'}>
          <div className="mb-3 hidden text-lg font-semibold print:block">{formatDayLabel(index, day.date)}</div>
          <DayBoard trip={trip} day={day} index={index} showMap={day.id === activeDay?.id} />
        </div>
      ))}
      <Wishlist trip={trip} />
    </div>
  )
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
