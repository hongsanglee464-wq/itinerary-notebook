import { formatDistance, formatDuration, MODE_LABEL } from '@/lib/format'
import type { DayRoute, TravelMode } from '@/types'

export function DayRoutePanel({
  route,
  pending,
  hasHotel,
  pointCount,
  mode,
}: {
  route?: DayRoute
  pending: boolean
  hasHotel: boolean
  pointCount: number
  mode: TravelMode
}) {
  return (
    <div className="rounded-xl border bg-card p-3 text-sm" aria-live="polite">
      <p className="font-medium">{MODE_LABEL[mode]}路線</p>
      {!hasHotel ? <p className="mt-1 text-xs text-muted-foreground">未設定住宿或起點，路線從第一個有座標的景點開始。</p> : null}
      {pointCount < 2 ? <p className="mt-1 text-muted-foreground">至少需要兩個有座標的點，才會計算距離與時間。</p> : null}
      {pending ? <p className="mt-1 text-muted-foreground">正在計算路線…</p> : null}
      {route?.error ? <p className="mt-2 rounded-lg bg-warn-bg px-2 py-1.5 text-warn">{route.error}</p> : null}
      {route && !pending ? (
        <>
          <p className="mt-2">
            全程 {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
            {route.source ? <span className="text-muted-foreground"> · {sourceLabel(route.source)}</span> : null}
          </p>
          {route.departureNote ? <p className="mt-1 text-xs text-muted-foreground">{route.departureNote}</p> : null}
          <ul className="mt-2 space-y-1">
            {route.legs.map((leg, index) => (
              <li key={`${leg.fromName}-${leg.toName}-${index}`}>
                {leg.fromName} → {leg.toName}
                {leg.error ? (
                  <span className="text-warn">：{leg.error}</span>
                ) : (
                  <span>
                    ：{formatDistance(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}
                    {leg.summary ? ` · ${leg.summary}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {route.omitted.length ? (
            <p className="mt-2 rounded-lg bg-warn-bg px-2 py-1.5 text-warn">沒有座標，未排入路線：{route.omitted.join('、')}</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function sourceLabel(source: NonNullable<DayRoute['source']>): string {
  if (source === 'osrm') return 'OSRM'
  if (source === 'transitous') return 'Transitous'
  return 'Google'
}
