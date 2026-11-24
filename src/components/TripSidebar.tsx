import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStore } from '@/store'
import { CURRENCIES } from '@/types'

export function TripSidebar() {
  const store = useStore()
  const [open, setOpen] = useState(store.data.trips.length === 0)
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currency, setCurrency] = useState<string>('TWD')
  const [error, setError] = useState('')

  function create(event: FormEvent) {
    event.preventDefault()
    if (startDate && endDate && endDate < startDate) {
      setError('結束日早於開始日。')
      return
    }
    store.createTrip({ title, destination, startDate: startDate || undefined, endDate: endDate || undefined, currency })
    setTitle('')
    setDestination('')
    setStartDate('')
    setEndDate('')
    setError('')
    setOpen(false)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">我的行程</h2>
        <Button type="button" size="sm" variant={open ? 'secondary' : 'default'} onClick={() => setOpen(value => !value)}>
          {open ? '關閉' : '新行程'}
        </Button>
      </div>
      {open ? (
        <form onSubmit={create} className="space-y-2 rounded-xl border bg-card p-3">
          <Label htmlFor="trip-title">名稱</Label>
          <Input id="trip-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：京都四天" />
          <Label htmlFor="trip-destination">目的地</Label>
          <Input id="trip-destination" value={destination} onChange={event => setDestination(event.target.value)} placeholder="例如：京都市" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              開始
              <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1" />
            </label>
            <label className="text-sm">
              結束
              <Input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1" />
            </label>
          </div>
          <label className="block text-sm">
            幣別
            <select className="mt-1 h-8 w-full rounded-lg border bg-transparent px-2" value={currency} onChange={event => setCurrency(event.target.value)}>
              {CURRENCIES.map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit">建立行程</Button>
        </form>
      ) : null}
      {store.data.trips.length === 0 ? <p className="text-sm text-muted-foreground">還沒有行程。建立一趟，把景點、住宿和花費放在一起。</p> : null}
      <ul className="space-y-1">
        {store.data.trips.map(trip => {
          const active = trip.id === store.data.activeTripId
          return (
            <li key={trip.id}>
              <button
                type="button"
                onClick={() => store.selectTrip(trip.id)}
                className={`w-full rounded-lg px-3 py-2 text-left ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <span className="block truncate font-medium">{trip.title}</span>
                <span className={`block truncate text-xs ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {trip.destination || '未填目的地'}
                  {trip.startDate ? ` · ${trip.startDate}` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
