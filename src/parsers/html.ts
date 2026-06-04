import type { ParsedItem } from '../types.ts'
import { decodeXml, stripHtml } from './feed.ts'

export type HtmlParseResult = {
  items: ParsedItem[]
  discoveredFeeds: string[]
}

export function parseHtml(html: string, baseUrl: string): HtmlParseResult {
  const title = stripHtml(textOf(html, 'title')) || metaContent(html, 'og:title') || baseUrl
  const canonical = absolutize(attrOf(html, 'link', 'href', /rel=["'][^"']*canonical[^"']*["']/i), baseUrl) || baseUrl
  const published = metaContent(html, 'article:published_time') || attrOf(html, 'time', 'datetime')
  const summary = metaContent(html, 'description') || metaContent(html, 'og:description') || firstParagraph(html)
  return {
    items: [{
      item_type: 'article',
      title,
      external_url: baseUrl,
      canonical_url: canonical,
      published_at: normalizeDate(published),
      event_start_at: null,
      event_end_at: null,
      location_text: null,
      summary,
    }],
    discoveredFeeds: discoverFeedLinks(html, baseUrl),
  }
}

export function discoverFeedLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>()
  const re = /<link\b([^>]*)>/gi
  for (const match of html.matchAll(re)) {
    const attrs = match[1]
    if (!/rel=["'][^"']*alternate[^"']*["']/i.test(attrs)) continue
    if (!/type=["'](?:application\/rss\+xml|application\/atom\+xml|application\/feed\+json|text\/xml|application\/xml)["']/i.test(attrs)) continue
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1]
    const url = absolutize(href ? decodeXml(href) : null, baseUrl)
    if (url) links.add(url)
  }
  return Array.from(links)
}

function textOf(text: string, tag: string): string | null {
  const match = text.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1].trim()) : null
}

function attrOf(text: string, tag: string, attr: string, requiredPattern?: RegExp): string | null {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'gi')
  for (const match of text.matchAll(re)) {
    const attrs = match[1]
    if (requiredPattern && !requiredPattern.test(attrs)) continue
    const attrMatch = attrs.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
    if (attrMatch) return decodeXml(attrMatch[1])
  }
  return null
}

function metaContent(html: string, name: string): string | null {
  const re = /<meta\b([^>]*)>/gi
  for (const match of html.matchAll(re)) {
    const attrs = match[1]
    if (!new RegExp(`(?:name|property)=["']${escapeRegExp(name)}["']`, 'i').test(attrs)) continue
    const content = attrs.match(/content=["']([^"']+)["']/i)
    if (content) return decodeXml(content[1]).trim()
  }
  return null
}

function firstParagraph(html: string): string | null {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)
  return stripHtml(match?.[1] ?? null)
}

function absolutize(value: string | null, baseUrl: string): string | null {
  if (!value) return null
  try {
    return new URL(value, baseUrl).href
  } catch {
    return value
  }
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
