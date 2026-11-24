import type { BookingStatus, TravelMode } from '@/types'

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  not_booked: '未預訂',
  booked: '已預訂',
  paid: '已付款',
}

export const MODE_LABEL: Record<TravelMode, string> = {
  driving: '開車',
  walking: '步行',
  transit: '大眾運輸',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('zh-Hant', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

export function formatDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '距離未提供'
  if (meters < 1000) return `${Math.round(meters)} 公尺`
  const digits = meters < 10000 ? 1 : 0
  return `${(meters / 1000).toFixed(digits)} 公里`
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '時間未提供'
  if (seconds < 45) return '不到 1 分鐘'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `約 ${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `約 ${hours} 小時 ${rest} 分鐘` : `約 ${hours} 小時`
}

export function formatDayLabel(index: number, date?: string): string {
  if (!date) return `第 ${index + 1} 天`
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return `第 ${index + 1} 天`
  return `第 ${index + 1} 天 · ${date.slice(5)}（${WEEKDAYS[parsed.getDay()]}）`
}

export function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return `${date.slice(5)}（${WEEKDAYS[parsed.getDay()]}）`
}

export function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return null
  }
  return null
}

export function fileSlug(title: string): string {
  const slug = title.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40)
  return slug || '行程'
}
