import type { ParsedItem, ResourceKind } from '../types.ts'

export function looksLikeFeed(contentType: string | null, body: string): boolean {
  const type = contentType ?? ''
  const start = body.trimStart().slice(0, 200).toLowerCase()
  return /xml|rss|atom/.test(type) || start.startsWith('<rss') || start.startsWith('<feed') || start.includes('<rdf:rdf')
}

export function parseFeed(xml: string, fallbackType: ResourceKind = 'article'): ParsedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? []
  return blocks.map((block) => {
    const isEntry = /^<entry\b/i.test(block)
    const videoId = textOf(block, 'yt:videoId') || textOf(block, 'videoId')
    const enclosure = attrOf(block, 'enclosure', 'url')
    const alternate = attrOf(block, 'link', 'href', /rel=["']alternate["']/i) || attrOf(block, 'link', 'href')
    const rssLink = textOf(block, 'link')
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : alternate || rssLink || enclosure
    const podcastSummary = textOf(block, 'itunes:summary') || textOf(block, 'summary') || textOf(block, 'description') || textOf(block, 'content:encoded') || textOf(block, 'content')
    const itemType = videoId ? 'video' : enclosure && /audio|mpeg|mp3|m4a/i.test(block) ? 'podcast' : fallbackType
    return {
      item_type: itemType,
      title: textOf(block, 'title') || '(Untitled)',
      external_url: url,
      canonical_url: textOf(block, 'guid') || url,
      published_at: normalizeDate(textOf(block, 'pubDate') || textOf(block, 'published') || textOf(block, 'updated') || textOf(block, 'dc:date')),
      event_start_at: null,
      event_end_at: null,
      location_text: null,
      summary: stripHtml(podcastSummary),
    } satisfies ParsedItem
  }).filter((item) => item.title || item.external_url)
}

export function textOf(text: string, tag: string): string | null {
  const escaped = tag.replace(':', '(?::|\\\\:)')
  const match = text.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
  return match ? decodeXml(stripCdata(match[1]).trim()) : null
}

export function attrOf(text: string, tag: string, attr: string, requiredPattern?: RegExp): string | null {
  const escaped = tag.replace(':', '(?::|\\\\:)')
  const re = new RegExp(`<${escaped}\\b([^>]*)\\/?\\s*>`, 'gi')
  for (const match of text.matchAll(re)) {
    const attrs = match[1]
    if (requiredPattern && !requiredPattern.test(attrs)) continue
    const attrMatch = attrs.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
    if (attrMatch) return decodeXml(attrMatch[1])
  }
  return null
}

export function stripHtml(value: string | null): string | null {
  if (!value) return null
  return decodeXml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || null
}

export function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString()
}
