import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hoursLabel } from '@/lib/hours'
import { findPlaces } from '@/lib/places'
import type { Place } from '@/types'
import { PlaceImage } from '@/components/PlaceImage'

type Props = {
  submitLabel: string
  extraLabel?: string
  onSubmit: (place: Place) => void
  onExtra?: (place: Place) => void
}

export function PlaceAdder({ submitLabel, extraLabel, onSubmit, onExtra }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [message, setMessage] = useState('')

  async function search(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setStatus('loading')
    setMessage('正在辨認地點、圖片與營業時間…')
    setResults([])
    try {
      const places = await findPlaces(trimmed)
      setResults(places)
      setStatus('done')
      setMessage(places.length > 1 ? `找到 ${places.length} 個結果，請選一個。` : '請確認這是要加入的地點。')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '搜尋失敗。')
    }
  }

  function choose(place: Place, extra = false) {
    if (extra) onExtra?.(place)
    else onSubmit(place)
    setQuery('')
    setResults([])
    setStatus('done')
    setMessage(extra ? '已加入願望清單。' : '已加入。')
  }

  return (
    <form onSubmit={search} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="輸入地名，或貼上地圖／官網連結"
          aria-label="地名或連結"
        />
        <Button type="submit" disabled={status === 'loading' || !query.trim()}>
          {status === 'loading' ? '搜尋中…' : '搜尋'}
        </Button>
      </div>
      {message ? (
        <p className={status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} role="status">
          {message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">例如：國立故宮博物院，或貼上 Google 地圖、OpenStreetMap、官網連結。</p>
      )}
      <ul className="space-y-2">
        {results.map(place => (
          <li key={place.id} className="flex gap-3 rounded-xl border bg-card p-2">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
              <PlaceImage photos={place.photos} alt={place.name} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{place.name}</p>
              {place.category ? <p className="text-xs text-muted-foreground">{place.category}</p> : null}
              {place.address ? <p className="truncate text-xs text-muted-foreground">{place.address}</p> : null}
              <p className="truncate text-xs text-muted-foreground">
                {hoursLabel(place.hours) ? `營業時間：${hoursLabel(place.hours)}` : '尚無營業時間'}
                {place.lat == null ? ' · 沒有座標' : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => choose(place)}>
                  {submitLabel}
                </Button>
                {extraLabel && onExtra ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => choose(place, true)}>
                    {extraLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </form>
  )
}
