export type WeatherDay = {
  date: string
  code: number | null
  label: string | null
  tempMax: number | null
  tempMin: number | null
  precipProbability: number | null
}

export type WeatherReport = {
  timezone?: string
  days: WeatherDay[]
  error?: string
}

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'

const WEATHER_LABELS: Record<number, string> = {
  0: '晴',
  1: '大致晴朗',
  2: '局部多雲',
  3: '陰',
  45: '霧',
  48: '霧凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '濃毛毛雨',
  56: '凍毛毛雨',
  57: '濃凍毛毛雨',
  61: '小雨',
  63: '雨',
  65: '大雨',
  66: '凍雨',
  67: '強凍雨',
  71: '小雪',
  73: '雪',
  75: '大雪',
  77: '雪粒',
  80: '小陣雨',
  81: '陣雨',
  82: '強陣雨',
  85: '小陣雪',
  86: '大陣雪',
  95: '雷雨',
  96: '雷雨夾小冰雹',
  99: '雷雨夾大冰雹',
}

export function weatherLabel(code: number | null): string | null {
  if (code == null) return null
  return WEATHER_LABELS[code] ?? null
}

export async function fetchWeather(lat: number, lng: number, start?: string, end?: string): Promise<WeatherReport> {
  const today = localDate()
  if (start && start > addDays(today, 16)) {
    return { days: [], error: '日期超出免費預報範圍（約 16 天），沒有可顯示的天氣。' }
  }
  const archive = Boolean(end && end < today)
  const endpoint = archive ? ARCHIVE : FORECAST
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
  })
  if (start && end) {
    params.set('start_date', start)
    params.set('end_date', end)
  } else {
    params.set('forecast_days', '5')
  }
  let response: Response
  try {
    response = await fetch(`${endpoint}?${params}`)
  } catch {
    return { days: [], error: '天氣服務（Open-Meteo）暫時無法連線。' }
  }
  const data = (await response.json()) as {
    timezone?: string
    reason?: string
    error?: boolean
    daily?: {
      time?: string[]
      weather_code?: Array<number | null>
      temperature_2m_max?: Array<number | null>
      temperature_2m_min?: Array<number | null>
      precipitation_probability_max?: Array<number | null>
    }
  }
  if (!response.ok || data.error || !data.daily?.time) {
    return { timezone: data.timezone, days: [], error: data.reason || `無法取得天氣（HTTP ${response.status}）。` }
  }
  const days = data.daily.time.map((date, index) => {
    const code = data.daily?.weather_code?.[index] ?? null
    return {
      date,
      code,
      label: weatherLabel(code),
      tempMax: data.daily?.temperature_2m_max?.[index] ?? null,
      tempMin: data.daily?.temperature_2m_min?.[index] ?? null,
      precipProbability: data.daily?.precipitation_probability_max?.[index] ?? null,
    }
  })
  return { timezone: data.timezone, days }
}

function localDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
