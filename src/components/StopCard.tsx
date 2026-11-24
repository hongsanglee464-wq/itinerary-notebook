import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlaceImage } from '@/components/PlaceImage'
import { BOOKING_LABEL } from '@/lib/format'
import { judgeHours } from '@/lib/hours'
import { lookupGoogleHours } from '@/lib/google'
import { safeHttpUrl } from '@/lib/format'
import type { BookingStatus, Stop } from '@/types'

const BOOKINGS = Object.entries(BOOKING_LABEL) as Array<[BookingStatus, string]>

type Props = {
  stop: Stop
  index: number
  date?: string
  currency: string
  googleKey?: string
  onChange: (patch: {
    arrivalTime?: string | null
    cost?: number | null
    bookingStatus?: BookingStatus
    placeName?: string
    hours?: Stop['place']['hours'] | null
  }) => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}

export function StopCard({ stop, index, date, currency, googleKey, onChange, onDelete, onMove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const judgement = judgeHours(stop.place, date, stop.arrivalTime)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [costText, setCostText] = useState(stop.cost == null ? '' : String(stop.cost))
  const link = safeHttpUrl(stop.place.sourceUrl)
  const style = { transform: CSS.Transform.toString(transform), transition }

  async function lookupHours() {
    if (!googleKey) return
    setLookingUp(true)
    setLookupError('')
    try {
      const result = await lookupGoogleHours(stop.place.name, stop.place.lat, stop.place.lng, googleKey)
      onChange({ hours: result.hours })
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Google 營業時間查詢失敗。')
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <li ref={setNodeRef} style={style} className={`rounded-xl border bg-card p-2 ${isDragging ? 'opacity-70' : ''}`}>
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-1 hidden h-8 w-6 shrink-0 cursor-grab text-muted-foreground sm:block"
          aria-label={`拖曳調整 ${stop.place.name} 的順序`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-lg border sm:h-24 sm:w-24">
          <PlaceImage photos={stop.place.photos} alt={stop.place.name} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <Input
              aria-label="景點名稱"
              value={stop.place.name}
              onChange={event => onChange({ placeName: event.target.value })}
              className="font-medium"
            />
          </div>
          {stop.place.address ? <p className="text-xs text-muted-foreground">{stop.place.address}</p> : null}
          {link ? (
            <a className="block truncate text-xs text-primary underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">
              {link}
            </a>
          ) : null}
          <p className={`px-2 py-1.5 text-xs ${judgement.level === 'warn' ? 'rounded-lg bg-warn-bg text-warn' : 'text-emerald-800'}`}>
            <span className="font-medium">{judgement.title}</span>
            <span className="mt-0.5 block">{judgement.detail}</span>
          </p>
          {lookupError ? <p className="text-xs text-destructive">{lookupError}</p> : null}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              預計抵達
              <Input
                type="time"
                value={stop.arrivalTime ?? ''}
                onChange={event => onChange({ arrivalTime: event.target.value || null })}
                className="mt-1 w-[7.5rem]"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              票價／費用（{currency}）
              <Input
                inputMode="decimal"
                value={costText}
                onChange={event => {
                  const next = event.target.value
                  if (next && !/^\d*\.?\d*$/.test(next)) return
                  setCostText(next)
                  onChange({ cost: parseCost(next) })
                }}
                className="mt-1 w-28"
                placeholder="未填"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="預訂狀態">
            {BOOKINGS.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="xs"
                variant={stop.bookingStatus === value ? 'default' : 'outline'}
                aria-pressed={stop.bookingStatus === value}
                onClick={() => onChange({ bookingStatus: value })}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="icon-sm" variant="outline" aria-label="上移" onClick={() => onMove(-1)}>
              <ChevronUp />
            </Button>
            <Button type="button" size="icon-sm" variant="outline" aria-label="下移" onClick={() => onMove(1)}>
              <ChevronDown />
            </Button>
            {googleKey && (!stop.place.hours || judgement.title.includes('無法判斷')) ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void lookupHours()} disabled={lookingUp}>
                {lookingUp ? '查詢中…' : '用金鑰查營業時間'}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              刪除
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

function parseCost(value: string): number | null {
  if (!value.trim() || value === '.') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return amount
}
