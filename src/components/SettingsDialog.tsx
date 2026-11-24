import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStore } from '@/store'

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useStore()
  const [key, setKey] = useState(store.googleMapsKey ?? '')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setKey(store.googleMapsKey ?? '')
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>沒有金鑰也能用。金鑰只留在這台瀏覽器，不會放進匯出檔或分享連結。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="google-key">Google Maps JavaScript API 金鑰（選填）</Label>
          <Input
            id="google-key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={event => setKey(event.target.value)}
            placeholder="沒有金鑰就留白"
          />
          <p className="text-xs text-muted-foreground">
            開車與步行使用 OSRM，大眾運輸先用 Transitous，營業時間先用 OpenStreetMap。金鑰只在這些免費來源沒有結果時，用來再查 Google 路線或營業時間。請啟用 Maps JavaScript、Places 與 Directions。
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                store.setGoogleMapsKey(key)
                onOpenChange(false)
              }}
            >
              儲存
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setKey('')
                store.setGoogleMapsKey('')
              }}
            >
              清除金鑰
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
