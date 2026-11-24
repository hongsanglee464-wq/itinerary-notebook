import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { photoSourceLabel } from '@/lib/photoUrl'
import type { PlacePhoto } from '@/types'

export function PlaceImage({ photos, alt }: { photos: PlacePhoto[]; alt: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const photo = photos.find(item => !failed.includes(item.url))
  if (!photo) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted px-1 text-center text-muted-foreground">
        <ImageOff className="size-4" aria-hidden />
        <span className="text-[11px] leading-tight">尚無圖片</span>
      </div>
    )
  }
  return (
    <img
      src={photo.url}
      alt={alt}
      title={`圖片來源：${photoSourceLabel(photo.source)}`}
      className="h-full w-full object-cover"
      onError={() => setFailed(current => (current.includes(photo.url) ? current : [...current, photo.url]))}
    />
  )
}
