import { isUsablePhotoUrl } from './photoUrl.ts'

export type PreviewExtract = {
  title?: string
  imageUrl?: string
}

export function extractPreview(html: string, baseUrl: string): PreviewExtract {
  const title = clean(metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || tagText(html, 'title'))
  const image = firstUsable(
    [metaContent(html, 'og:image'), metaContent(html, 'twitter:image'), linkHref(html, 'image_src')],
    baseUrl,
  )
  return { title, imageUrl: image }
}

export function isBlockedRequestUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return true
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0' || host === '::1') {
    return true
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  const parts = ipv4.slice(1).map(Number)
  const [a, b] = parts
  if (parts.some(part => part > 255)) return true
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

function firstUsable(values: Array<string | undefined>, baseUrl: string): string | undefined {
  for (const value of values) {
    if (!value) continue
    const resolved = resolveUrl(decodeEntities(value), baseUrl)
    if (resolved && isUsablePhotoUrl(resolved)) return resolved
  }
  return undefined
}

function metaContent(html: string, key: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const property = attr(tag, 'property') || attr(tag, 'name')
    if (property?.toLowerCase() !== key.toLowerCase()) continue
    const content = attr(tag, 'content')
    if (content) return content
  }
  return undefined
}

function linkHref(html: string, rel: string): string | undefined {
  const tags = html.match(/<link\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    if ((attr(tag, 'rel') || '').toLowerCase() !== rel) continue
    const href = attr(tag, 'href')
    if (href) return href
  }
  return undefined
}

function tagText(html: string, tag: string): string | undefined {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return match?.[1]
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[2] ?? match?.[3] ?? match?.[4]
}

function resolveUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
}

function clean(value: string | undefined): string | undefined {
  const text = value ? decodeEntities(value).replace(/\s+/g, ' ').trim() : ''
  return text ? text.slice(0, 180) : undefined
}
