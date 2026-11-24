import { useEffect } from 'react'
import { divIcon, type LatLngBoundsExpression } from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'

export type MapPoint = {
  id: string
  name: string
  lat: number
  lng: number
  kind: 'hotel' | 'stop'
  label: string
}

export function MapPane({ points, geometry }: { points: MapPoint[]; geometry: Array<[number, number]> }) {
  const center = points[0]
  if (!center) {
    return <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">設定住宿或加入有座標的景點後，地圖會標出順序。</p>
  }
  return (
    <div className="h-64 overflow-hidden rounded-xl border sm:h-80">
      <MapContainer center={[center.lat, center.lng]} zoom={14} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {geometry.length > 1 ? <Polyline positions={geometry} pathOptions={{ color: '#0f5c56', weight: 4 }} /> : null}
        {points.map(point => (
          <Marker key={point.id} position={[point.lat, point.lng]} icon={pinIcon(point.label, point.kind)}>
            <Popup>
              {point.kind === 'hotel' ? '住宿／起點：' : ''}
              {point.name}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap()
  const key = points.map(point => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(';')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1 && points[0]) {
      map.setView([points[0].lat, points[0].lng], 16)
      return
    }
    const bounds: LatLngBoundsExpression = points.map(point => [point.lat, point.lng])
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 })
  }, [map, key])
  return null
}

function pinIcon(label: string, kind: 'hotel' | 'stop') {
  return divIcon({
    className: 'map-pin',
    html: `<span class="${kind === 'hotel' ? 'is-hotel' : 'is-stop'}">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}
