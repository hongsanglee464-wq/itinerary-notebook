export type BookingStatus = 'not_booked' | 'booked' | 'paid'

export type TravelMode = 'driving' | 'walking' | 'transit'

export type PhotoSource = 'open-graph' | 'wikimedia' | 'osm'

export type PlacePhoto = {
  url: string
  source: PhotoSource
}

export type HoursPeriod = {
  open: { day: number; time: string }
  close?: { day: number; time: string }
}

export type HoursData = {
  source: 'osm' | 'google'
  osm?: string
  weekdayText?: string[]
  periods?: HoursPeriod[]
}

export type Place = {
  id: string
  name: string
  address?: string
  lat?: number
  lng?: number
  countryCode?: string
  sourceUrl?: string
  photos: PlacePhoto[]
  hours?: HoursData
  hoursChecked: boolean
  category?: string
}

export type Stop = {
  id: string
  place: Place
  arrivalTime?: string
  cost?: number
  bookingStatus: BookingStatus
}

export type RouteLeg = {
  fromName: string
  toName: string
  distanceMeters: number | null
  durationSeconds: number | null
  summary?: string
  error?: string
}

export type DayRoute = {
  signature: string
  mode: TravelMode
  source?: 'osrm' | 'transitous' | 'google'
  legs: RouteLeg[]
  geometry: Array<[number, number]>
  distanceMeters: number | null
  durationSeconds: number | null
  omitted: string[]
  departureNote?: string
  error?: string
  calculatedAt: string
}

export type DayPlan = {
  id: string
  date?: string
  hotel?: Place
  stops: Stop[]
  travelMode: TravelMode
  route?: DayRoute
}

export type WishItem = {
  id: string
  place: Place
}

export type Trip = {
  id: string
  title: string
  destination: string
  startDate?: string
  endDate?: string
  currency: string
  timezone?: string
  days: DayPlan[]
  wishlist: WishItem[]
  updatedAt: string
}

export type AppData = {
  version: 1
  trips: Trip[]
  activeTripId?: string
  googleMapsKey?: string
}

export const CURRENCIES = ['TWD', 'JPY', 'USD', 'EUR', 'HKD', 'KRW', 'GBP', 'CNY'] as const
