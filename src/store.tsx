import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadAppData, saveAppData } from '@/storage'
import { clonePlace, createDay, createTrip, nextDate } from '@/lib/tripModel'
import type { AppData, BookingStatus, DayPlan, DayRoute, Place, PlacePhoto, TravelMode, Trip } from '@/types'

type StopPatch = {
  arrivalTime?: string | null
  cost?: number | null
  bookingStatus?: BookingStatus
  placeName?: string
  hours?: Place['hours'] | null
  photos?: PlacePhoto[]
}

type StoreValue = {
  data: AppData
  activeTrip?: Trip
  googleMapsKey?: string
  setGoogleMapsKey: (key: string) => void
  createTrip: (input: { title: string; destination: string; startDate?: string; endDate?: string; currency: string }) => void
  selectTrip: (id: string) => void
  deleteTrip: (id: string) => void
  updateTrip: (tripId: string, patch: Partial<Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate' | 'currency' | 'timezone'>>) => void
  addDay: (tripId: string) => void
  updateDay: (tripId: string, dayId: string, patch: Partial<Pick<DayPlan, 'date' | 'travelMode'>>) => void
  deleteDay: (tripId: string, dayId: string) => void
  setHotel: (tripId: string, dayId: string, place?: Place) => void
  copyHotelFromPrevious: (tripId: string, dayId: string) => void
  addStop: (tripId: string, dayId: string, place: Place) => void
  updateStop: (tripId: string, dayId: string, stopId: string, patch: StopPatch) => void
  deleteStop: (tripId: string, dayId: string, stopId: string) => void
  moveStop: (tripId: string, dayId: string, stopId: string, direction: -1 | 1) => void
  reorderStops: (tripId: string, dayId: string, activeId: string, overId: string) => void
  setRoute: (tripId: string, dayId: string, route?: DayRoute) => void
  addWish: (tripId: string, place: Place) => void
  deleteWish: (tripId: string, wishId: string) => void
  moveWishToDay: (tripId: string, wishId: string, dayId: string) => void
  importTrip: (trip: Trip) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData())
  useEffect(() => {
    saveAppData(data)
  }, [data])

  const update = useCallback((recipe: (current: AppData) => AppData) => {
    setData(current => recipe(current))
  }, [])

  const value = useMemo<StoreValue>(() => {
    const activeTrip = data.trips.find(trip => trip.id === data.activeTripId)
    return {
      data,
      activeTrip,
      googleMapsKey: data.googleMapsKey,
      setGoogleMapsKey: key => update(current => ({ ...current, googleMapsKey: key.trim() || undefined })),
      createTrip: input => {
        const trip = createTrip(input)
        update(current => ({ ...current, trips: [trip, ...current.trips], activeTripId: trip.id }))
      },
      selectTrip: id => update(current => ({ ...current, activeTripId: id })),
      deleteTrip: id =>
        update(current => {
          const trips = current.trips.filter(trip => trip.id !== id)
          return { ...current, trips, activeTripId: current.activeTripId === id ? trips[0]?.id : current.activeTripId }
        }),
      updateTrip: (tripId, patch) => update(current => withTrip(current, tripId, trip => ({ ...trip, ...patch }))),
      addDay: tripId =>
        update(current =>
          withTrip(current, tripId, trip => {
            const previous = trip.days[trip.days.length - 1]
            return { ...trip, days: [...trip.days, createDay(nextDate(previous?.date))] }
          }),
        ),
      updateDay: (tripId, dayId, patch) =>
        update(current => withTrip(current, tripId, trip => ({ ...trip, days: trip.days.map(day => (day.id === dayId ? { ...day, ...patch } : day)) }))),
      deleteDay: (tripId, dayId) =>
        update(current => withTrip(current, tripId, trip => ({ ...trip, days: trip.days.filter(day => day.id !== dayId) }))),
      setHotel: (tripId, dayId, place) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day => (day.id === dayId ? { ...day, hotel: place ? clonePlace(place) : undefined, route: undefined } : day)),
          })),
        ),
      copyHotelFromPrevious: (tripId, dayId) =>
        update(current =>
          withTrip(current, tripId, trip => {
            const index = trip.days.findIndex(day => day.id === dayId)
            const previous = trip.days[index - 1]?.hotel
            if (!previous) return trip
            return {
              ...trip,
              days: trip.days.map(day => (day.id === dayId ? { ...day, hotel: clonePlace(previous), route: undefined } : day)),
            }
          }),
        ),
      addStop: (tripId, dayId, place) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day =>
              day.id === dayId
                ? {
                    ...day,
                    route: undefined,
                    stops: [...day.stops, { id: crypto.randomUUID(), place: clonePlace(place), bookingStatus: 'not_booked' }],
                  }
                : day,
            ),
          })),
        ),
      updateStop: (tripId, dayId, stopId, patch) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day =>
              day.id === dayId
                ? {
                    ...day,
                    stops: day.stops.map(stop => {
                      if (stop.id !== stopId) return stop
                      return {
                        ...stop,
                        arrivalTime: patch.arrivalTime === null ? undefined : patch.arrivalTime ?? stop.arrivalTime,
                        cost: patch.cost === null ? undefined : patch.cost ?? stop.cost,
                        bookingStatus: patch.bookingStatus ?? stop.bookingStatus,
                        place: {
                          ...stop.place,
                          name: patch.placeName ?? stop.place.name,
                          hours: patch.hours === null ? undefined : patch.hours ?? stop.place.hours,
                          photos: patch.photos ?? stop.place.photos,
                          hoursChecked: patch.hours === null || patch.hours ? true : stop.place.hoursChecked,
                        },
                      }
                    }),
                  }
                : day,
            ),
          })),
        ),
      deleteStop: (tripId, dayId, stopId) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day =>
              day.id === dayId ? { ...day, route: undefined, stops: day.stops.filter(stop => stop.id !== stopId) } : day,
            ),
          })),
        ),
      moveStop: (tripId, dayId, stopId, direction) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day => {
              if (day.id !== dayId) return day
              const index = day.stops.findIndex(stop => stop.id === stopId)
              const target = index + direction
              if (index < 0 || target < 0 || target >= day.stops.length) return day
              const stops = day.stops.slice()
              const [item] = stops.splice(index, 1)
              if (!item) return day
              stops.splice(target, 0, item)
              return { ...day, stops, route: undefined }
            }),
          })),
        ),
      reorderStops: (tripId, dayId, activeId, overId) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day => {
              if (day.id !== dayId || activeId === overId) return day
              const from = day.stops.findIndex(stop => stop.id === activeId)
              const to = day.stops.findIndex(stop => stop.id === overId)
              if (from < 0 || to < 0) return day
              const stops = day.stops.slice()
              const [item] = stops.splice(from, 1)
              if (!item) return day
              stops.splice(to, 0, item)
              return { ...day, stops, route: undefined }
            }),
          })),
        ),
      setRoute: (tripId, dayId, route) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            days: trip.days.map(day => (day.id === dayId ? { ...day, route } : day)),
          })),
        ),
      addWish: (tripId, place) =>
        update(current =>
          withTrip(current, tripId, trip => ({
            ...trip,
            wishlist: [{ id: crypto.randomUUID(), place: clonePlace(place) }, ...trip.wishlist],
          })),
        ),
      deleteWish: (tripId, wishId) =>
        update(current => withTrip(current, tripId, trip => ({ ...trip, wishlist: trip.wishlist.filter(item => item.id !== wishId) }))),
      moveWishToDay: (tripId, wishId, dayId) =>
        update(current =>
          withTrip(current, tripId, trip => {
            const wish = trip.wishlist.find(item => item.id === wishId)
            if (!wish) return trip
            return {
              ...trip,
              wishlist: trip.wishlist.filter(item => item.id !== wishId),
              days: trip.days.map(day =>
                day.id === dayId
                  ? {
                      ...day,
                      route: undefined,
                      stops: [...day.stops, { id: crypto.randomUUID(), place: clonePlace(wish.place), bookingStatus: 'not_booked' }],
                    }
                  : day,
              ),
            }
          }),
        ),
      importTrip: trip => {
        const imported = { ...trip, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }
        update(current => ({ ...current, trips: [imported, ...current.trips], activeTripId: imported.id }))
      },
    }
  }, [data, update])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider 尚未掛載')
  return store
}

function withTrip(data: AppData, tripId: string, recipe: (trip: Trip) => Trip): AppData {
  return {
    ...data,
    trips: data.trips.map(trip => (trip.id === tripId ? { ...recipe(trip), updatedAt: new Date().toISOString() } : trip)),
  }
}

export type { TravelMode }
