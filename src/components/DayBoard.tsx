import { useEffect, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DayRoutePanel } from '@/components/DayRoutePanel'
import { MapPane, type MapPoint } from '@/components/MapPane'
import { PlaceAdder } from '@/components/PlaceAdder'
import { PlaceImage } from '@/components/PlaceImage'
import { StopCard } from '@/components/StopCard'
import { MODE_LABEL } from '@/lib/format'
import { routeBetween, routeEndpoints, routeSignature } from '@/lib/routing'
import { useStore } from '@/store'
import type { DayPlan, TravelMode, Trip } from '@/types'

export function DayBoard({ trip, day, index, showMap }: { trip: Trip; day: DayPlan; index: number; showMap: boolean }) {
  const store = useStore()
  const { points, omitted } = routeEndpoints(day)
  const signature = routeSignature(day.travelMode, day.date, trip.timezone, points, omitted, store.googleMapsKey)
  const [pending, setPending] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const route = day.route?.signature === signature ? day.route : undefined
  const displayRoute = route
    ? {
        ...route,
        legs: route.legs.map((leg, index) => ({
          ...leg,
          fromName: points[index]?.name ?? leg.fromName,
          toName: points[index + 1]?.name ?? leg.toName,
        })),
      }
    : undefined

  useEffect(() => {
    if (points.length < 2 || day.route?.signature === signature) {
      setPending(false)
      return
    }
    let cancelled = false
    setPending(true)
    void routeBetween(points, day.travelMode, {
      date: day.date,
      timeZone: trip.timezone,
      googleKey: store.googleMapsKey,
      omitted,
    })
      .then(result => {
        if (!cancelled) store.setRoute(trip.id, day.id, { ...result, signature })
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })
    return () => {
      cancelled = true
    }
    // The signature already covers the inputs that should trigger a new route.
  }, [signature])

  function onDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    store.reorderStops(trip.id, day.id, String(event.active.id), String(event.over.id))
  }

  const markers: MapPoint[] = []
  if (day.hotel?.lat != null && day.hotel.lng != null) {
    markers.push({ id: day.hotel.id, name: day.hotel.name, lat: day.hotel.lat, lng: day.hotel.lng, kind: 'hotel', label: '住' })
  }
  day.stops.forEach((stop, stopIndex) => {
    if (stop.place.lat == null || stop.place.lng == null) return
    markers.push({
      id: stop.id,
      name: stop.place.name,
      lat: stop.place.lat,
      lng: stop.place.lng,
      kind: 'stop',
      label: String(stopIndex + 1),
    })
  })
  const previousHotel = trip.days[index - 1]?.hotel

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          日期
          <Input
            type="date"
            value={day.date ?? ''}
            onChange={event => store.updateDay(trip.id, day.id, { date: event.target.value || undefined })}
            className="mt-1 w-40"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="交通方式">
          {(Object.entries(MODE_LABEL) as Array<[TravelMode, string]>).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={day.travelMode === mode ? 'default' : 'outline'}
              aria-pressed={day.travelMode === mode}
              onClick={() => store.updateDay(trip.id, day.id, { travelMode: mode })}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => store.deleteDay(trip.id, day.id)}>
          刪除這一天
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <h3 className="mb-2 text-sm font-medium">住宿／當日起點</h3>
        {day.hotel ? (
          <div className="mb-3 flex gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
              <PlaceImage photos={day.hotel.photos} alt={day.hotel.name} />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{day.hotel.name}</p>
              {day.hotel.address ? <p className="text-xs text-muted-foreground">{day.hotel.address}</p> : null}
              <Button type="button" size="sm" variant="ghost" className="mt-1 px-0" onClick={() => store.setHotel(trip.id, day.id, undefined)}>
                清除起點
              </Button>
            </div>
          </div>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">路線會從這裡出發。沒有設定時，改由第一個景點開始。</p>
        )}
        {previousHotel ? (
          <Button type="button" size="sm" variant="outline" className="mb-3" onClick={() => store.copyHotelFromPrevious(trip.id, day.id)}>
            沿用前一天的起點
          </Button>
        ) : null}
        <PlaceAdder submitLabel="設為住宿／起點" onSubmit={place => store.setHotel(trip.id, day.id, place)} />
      </div>

      {showMap ? <MapPane points={markers} geometry={route?.geometry ?? []} /> : null}
      <DayRoutePanel
        route={displayRoute}
        pending={pending}
        hasHotel={Boolean(day.hotel)}
        pointCount={points.length}
        mode={day.travelMode}
      />

      <div>
        <h3 className="mb-2 text-sm font-medium">景點順序</h3>
        <p className="mb-2 text-xs text-muted-foreground">拖曳或用上下按鈕調整順序。預計抵達只用來對照營業時間。</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={day.stops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {day.stops.map((stop, stopIndex) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  index={stopIndex}
                  date={day.date}
                  currency={trip.currency}
                  googleKey={store.googleMapsKey}
                  onChange={patch => store.updateStop(trip.id, day.id, stop.id, patch)}
                  onDelete={() => store.deleteStop(trip.id, day.id, stop.id)}
                  onMove={direction => store.moveStop(trip.id, day.id, stop.id, direction)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {day.stops.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">這一天還沒有景點。</p> : null}
        <div className="mt-3 rounded-xl border border-dashed p-3">
          <PlaceAdder
            submitLabel="加入這一天"
            extraLabel="改放願望清單"
            onSubmit={place => store.addStop(trip.id, day.id, place)}
            onExtra={place => store.addWish(trip.id, place)}
          />
        </div>
      </div>
    </section>
  )
}
