import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { extractPreview, isBlockedRequestUrl } from '../src/lib/previewHtml.ts'
import { isUsablePhotoUrl } from '../src/lib/photoUrl.ts'

export function linkPreviewPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const requestUrl = req.url ?? ''
    if (!requestUrl.startsWith('/api/link-preview')) {
      next()
      return
    }
    const target = new URL(requestUrl, 'http://127.0.0.1').searchParams.get('url')?.trim()
    if (!target || isBlockedRequestUrl(target)) {
      send(res, 400, { error: '只接受公開的 http 或 https 連結。' })
      return
    }
    try {
      const preview = await loadPreview(target)
      send(res, 200, preview)
    } catch (error) {
      send(res, 502, { error: error instanceof Error ? error.message : '無法讀取這個連結。' })
    }
  }
  return {
    name: 'link-preview',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
  }
}

async function loadPreview(target: string): Promise<{ finalUrl: string; title?: string; imageUrl?: string }> {
  const response = await fetch(target, {
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: 'text/html,application/xhtml+xml,image/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; ItineraryNotebook/0.1)',
    },
  })
  if (isBlockedRequestUrl(response.url)) throw new Error('連結被轉到不公開的網址，已停止讀取。')
  if (!response.ok) throw new Error(`無法讀取連結（HTTP ${response.status}）。`)
  const type = response.headers.get('content-type') ?? ''
  if (type.startsWith('image/') && isUsablePhotoUrl(response.url)) {
    return { finalUrl: response.url, imageUrl: response.url }
  }
  const html = await readLimited(response, 800_000)
  const extracted = extractPreview(html, response.url)
  return { finalUrl: response.url, title: extracted.title, imageUrl: extracted.imageUrl }
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return (await response.text()).slice(0, maxBytes)
  const chunks: Uint8Array[] = []
  let received = 0
  while (received < maxBytes) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    received += value.byteLength
  }
  await reader.cancel().catch(() => undefined)
  const combined = new Uint8Array(Math.min(received, maxBytes))
  let offset = 0
  for (const chunk of chunks) {
    const size = Math.min(chunk.byteLength, combined.length - offset)
    combined.set(chunk.subarray(0, size), offset)
    offset += size
    if (offset >= combined.length) break
  }
  return new TextDecoder().decode(combined)
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
