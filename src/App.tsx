import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SettingsDialog } from '@/components/SettingsDialog'
import { TripScreen } from '@/components/TripScreen'
import { TripSidebar } from '@/components/TripSidebar'
import { decodeTripHash } from '@/lib/share'
import { normalizeTrip } from '@/lib/tripModel'
import { StoreProvider, useStore } from '@/store'
import type { Trip } from '@/types'

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

function Shell() {
  const store = useStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shared, setShared] = useState<Trip | null>(null)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    const read = () => setShared(decodeTripHash(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  function clearHash() {
    window.history.replaceState(null, '', window.location.pathname)
    setShared(null)
  }

  function importFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as { trips?: unknown }
        if (parsed && Array.isArray(parsed.trips)) {
          let count = 0
          for (const item of parsed.trips) {
            const trip = normalizeTrip(item)
            if (trip) {
              store.importTrip(trip)
              count += 1
            }
          }
          if (!count) throw new Error('檔案裡沒有可讀的行程。')
          setImportError('')
          return
        }
        const trip = normalizeTrip(parsed)
        if (!trip) throw new Error('這個檔案不是行程筆記可以讀的格式。')
        store.importTrip(trip)
        setImportError('')
      } catch (error) {
        setImportError(error instanceof Error ? error.message : '無法讀取這個 JSON 檔。')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-svh">
      <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-lg font-semibold leading-none">行程筆記</p>
            <p className="mt-1 text-xs text-muted-foreground">住宿、景點、路線、營業時間和花費放在同一頁。</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) importFile(file)
                  event.target.value = ''
                }}
              />
              <span className="inline-flex h-8 items-center rounded-lg border px-2.5 text-sm">匯入 JSON</span>
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
              設定
            </Button>
          </div>
        </div>
      </header>
      {shared ? (
        <div className="no-print border-b bg-accent">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
            <p>這份連結帶有行程「{shared.title}」。</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  store.importTrip(shared)
                  clearHash()
                }}
              >
                匯入
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearHash}>
                略過
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {importError ? <p className="no-print mx-auto max-w-6xl px-4 py-2 text-sm text-destructive">{importError}</p> : null}
      <div className="mx-auto grid max-w-6xl md:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="no-print min-w-0 border-b md:border-r md:border-b-0">
          <TripSidebar />
        </aside>
        <main className="min-w-0">
          {store.activeTrip ? (
            <TripScreen trip={store.activeTrip} />
          ) : (
            <div className="p-6">
              <h1 className="text-xl font-semibold">從一趟新行程開始</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                建立行程後，可以用地名或連結加入景點，看地圖與路線，核對營業時間，並把還沒排定的地方放進願望清單。資料存在這台瀏覽器，不需要登入。
              </p>
            </div>
          )}
        </main>
      </div>
      <footer className="no-print mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
        地圖 © OpenStreetMap。路線：OSRM、Transitous。天氣：Open-Meteo。地名與營業時間：OpenStreetMap。圖片：頁面預覽或 Wikimedia。
        <a className="ml-1 underline" href="https://transitous.org/sources" target="_blank" rel="noreferrer">
          Transitous 資料來源
        </a>
      </footer>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
