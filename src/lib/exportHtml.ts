import { summarizeBudget } from '@/lib/budget'
import { BOOKING_LABEL, MODE_LABEL, fileSlug, formatDistance, formatDuration, formatMoney, safeHttpUrl } from '@/lib/format'
import { hoursLabel, judgeHours } from '@/lib/hours'
import type { WeatherReport } from '@/lib/weather'
import type { DayPlan, Place, Trip } from '@/types'

export function tripHtmlFilename(trip: Trip): string {
  return `${fileSlug(trip.title)}.html`
}

export function renderTripHtml(trip: Trip, weather?: WeatherReport | null): string {
  const budget = summarizeBudget(trip)
  const days = trip.days.map((day, index) => renderDay(trip, day, index)).join('')
  const wishes = trip.wishlist
    .map(item => `<li>${renderPlace(item.place)}</li>`)
    .join('')
  const weatherHtml = renderWeather(weather)
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(trip.title)} · 行程筆記</title>
  <style>
    body { margin: 0; font-family: "Noto Sans TC", "PingFang TC", sans-serif; color: #1f1a14; background: #f6f1e7; }
    main { max-width: 820px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 28px 0 8px; }
    h3 { font-size: 16px; margin: 0 0 8px; }
    section { background: #fffdf8; border: 1px solid #e3d7c4; border-radius: 16px; padding: 16px; margin-top: 12px; }
    .muted { color: #6a6158; }
    .warn { background: #fff6e8; color: #8a4b08; border-radius: 10px; padding: 8px 10px; }
    .ok { color: #1d6b43; }
    img { width: 96px; height: 96px; object-fit: cover; border-radius: 10px; background: #efe7d8; }
    .place { display: flex; gap: 12px; }
    .empty { width: 96px; height: 96px; border: 1px dashed #c9bba4; border-radius: 10px; display: grid; place-items: center; color: #6a6158; font-size: 12px; }
    ol { padding-left: 18px; }
    li { margin: 12px 0; }
    @media print { body { background: white; } section { break-inside: avoid; } }
  </style>
</head>
<body>
<main>
  <h1>${esc(trip.title)}</h1>
  <p>${esc(trip.destination || '未填目的地')}${trip.startDate ? ` · ${esc(trip.startDate)}` : ''}${trip.endDate ? ` 至 ${esc(trip.endDate)}` : ''}</p>
  <p>已填費用合計 ${esc(formatMoney(budget.total, trip.currency))}（${budget.filled} 項已填，${budget.blank} 項未填）</p>
  ${weatherHtml}
  ${days || '<p>這趟行程還沒有安排天數。</p>'}
  <h2>願望清單</h2>
  ${wishes ? `<ul>${wishes}</ul>` : '<p class="muted">願望清單是空的。</p>'}
  <p class="muted">由行程筆記匯出。距離、時間、營業時間與天氣只會在查到資料時顯示，沒有查到就保持空白或標成無法確認。</p>
</main>
</body>
</html>`
}

function renderDay(trip: Trip, day: DayPlan, index: number): string {
  const route = day.route
  const legs = route?.legs
    .map(leg => {
      if (leg.error) return `<li>${esc(leg.fromName)} → ${esc(leg.toName)}：${esc(leg.error)}</li>`
      return `<li>${esc(leg.fromName)} → ${esc(leg.toName)}：${esc(formatDistance(leg.distanceMeters))}，${esc(formatDuration(leg.durationSeconds))}${leg.summary ? `（${esc(leg.summary)}）` : ''}</li>`
    })
    .join('')
  const stops = day.stops
    .map((stop, stopIndex) => {
      const judgement = judgeHours(stop.place, day.date, stop.arrivalTime)
      const cost = typeof stop.cost === 'number' ? formatMoney(stop.cost, trip.currency) : '未填費用'
      return `<li>
        ${renderPlace(stop.place)}
        <p>第 ${stopIndex + 1} 個景點 · ${esc(cost)} · ${esc(BOOKING_LABEL[stop.bookingStatus])}${stop.arrivalTime ? ` · 預計抵達 ${esc(stop.arrivalTime)}` : ''}</p>
        <p class="${judgement.level === 'warn' ? 'warn' : 'ok'}">${esc(judgement.title)} ${esc(judgement.detail)}</p>
      </li>`
    })
    .join('')
  return `<section>
    <h2>第 ${index + 1} 天${day.date ? ` · ${esc(day.date)}` : ''}</h2>
    <p>交通方式：${esc(MODE_LABEL[day.travelMode])}</p>
    <h3>住宿／起點</h3>
    ${day.hotel ? renderPlace(day.hotel) : '<p class="muted">未設定</p>'}
    <h3>路線</h3>
    ${route?.error ? `<p class="warn">${esc(route.error)}</p>` : ''}
    ${route?.departureNote ? `<p class="muted">${esc(route.departureNote)}</p>` : '<p class="muted">尚未計算路線。</p>'}
    ${route ? `<p>全程 ${esc(formatDistance(route.distanceMeters))}，${esc(formatDuration(route.durationSeconds))}</p><ol>${legs}</ol>` : ''}
    ${route?.omitted.length ? `<p class="warn">沒有座標、未排入路線：${esc(route.omitted.join('、'))}</p>` : ''}
    <h3>景點</h3>
    ${stops ? `<ol>${stops}</ol>` : '<p class="muted">這一天還沒有景點。</p>'}
  </section>`
}

function renderPlace(place: Place): string {
  const photo = place.photos.map(item => safeHttpUrl(item.url)).find(Boolean)
  const image = photo
    ? `<img src="${esc(photo)}" alt="${esc(place.name)}" />`
    : '<div class="empty">尚無圖片</div>'
  const link = safeHttpUrl(place.sourceUrl)
  const hours = hoursLabel(place.hours)
  return `<div class="place">${image}<div>
    <strong>${esc(place.name)}</strong>
    ${place.category ? `<div class="muted">${esc(place.category)}</div>` : ''}
    ${place.address ? `<div>${esc(place.address)}</div>` : ''}
    ${hours ? `<div>營業時間：${esc(hours)}</div>` : ''}
    ${link ? `<div><a href="${esc(link)}">${esc(link)}</a></div>` : ''}
  </div></div>`
}

function renderWeather(weather?: WeatherReport | null): string {
  if (!weather) return '<p class="muted">匯出時沒有天氣資料。</p>'
  if (weather.error) return `<p class="warn">${esc(weather.error)}</p>`
  if (!weather.days.length) return '<p class="muted">匯出時沒有天氣資料。</p>'
  const rows = weather.days
    .map(day => {
      const temps = day.tempMin != null && day.tempMax != null ? `${day.tempMin}–${day.tempMax}°C` : '溫度未提供'
      const rain = day.precipProbability != null ? `降雨機率 ${day.precipProbability}%` : '降雨機率未提供'
      return `<li>${esc(day.date)} ${esc(day.label || (day.code != null ? `天氣代碼 ${day.code}` : '無天氣代碼'))}，${esc(temps)}，${esc(rain)}</li>`
    })
    .join('')
  return `<h2>天氣</h2><ul>${rows}</ul>`
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char] ?? char
  })
}
