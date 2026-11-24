import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlaceAdder } from '@/components/PlaceAdder'
import { PlaceImage } from '@/components/PlaceImage'
import { safeHttpUrl } from '@/lib/format'
import { useStore } from '@/store'
import type { Trip } from '@/types'

export function Wishlist({ trip }: { trip: Trip }) {
  const store = useStore()
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">願望清單</h2>
        <p className="text-xs text-muted-foreground">先收集還沒排進某一天的地方。移入後會從清單拿掉。</p>
      </div>
      {trip.wishlist.length === 0 ? <p className="text-sm text-muted-foreground">願望清單是空的。</p> : null}
      <ul className="space-y-2">
        {trip.wishlist.map(item => (
          <WishRow key={item.id} trip={trip} wishId={item.id} />
        ))}
      </ul>
      <div className="rounded-xl border border-dashed p-3">
        <PlaceAdder submitLabel="加入願望清單" onSubmit={place => store.addWish(trip.id, place)} />
      </div>
    </section>
  )
}

function WishRow({ trip, wishId }: { trip: Trip; wishId: string }) {
  const store = useStore()
  const item = trip.wishlist.find(wish => wish.id === wishId)
  const [dayId, setDayId] = useState(trip.days[0]?.id ?? '')
  if (!item) return null
  const link = safeHttpUrl(item.place.sourceUrl)
  return (
    <li className="flex gap-3 rounded-xl border bg-card p-2">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
        <PlaceImage photos={item.place.photos} alt={item.place.name} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.place.name}</p>
        {item.place.address ? <p className="truncate text-xs text-muted-foreground">{item.place.address}</p> : null}
        {link ? (
          <a className="block truncate text-xs text-primary underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">
            開啟連結
          </a>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-lg border bg-transparent px-2 text-sm"
            value={dayId}
            aria-label={`把${item.place.name}移入哪一天`}
            onChange={event => setDayId(event.target.value)}
            disabled={!trip.days.length}
          >
            {trip.days.map((day, index) => (
              <option key={day.id} value={day.id}>
                第 {index + 1} 天{day.date ? `（${day.date}）` : ''}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!dayId}
            onClick={() => store.moveWishToDay(trip.id, item.id, dayId)}
          >
            移入這一天
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => store.deleteWish(trip.id, item.id)}>
            刪除
          </Button>
        </div>
      </div>
    </li>
  )
}
