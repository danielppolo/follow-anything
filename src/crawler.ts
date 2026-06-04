import { buildStableKey } from './cache.ts'
import { looksLikeFeed, parseFeed } from './parsers/feed.ts'
import { parseHtml } from './parsers/html.ts'
import { looksLikeIcal, parseIcal } from './parsers/ical.ts'
import { isApplePodcastUrl, resolveApplePodcastFeedUrl } from './resolvers/apple-podcasts.ts'
import { isYouTubeChannelUrl, isYouTubeFeedUrl, resolveYouTubeFeedUrl } from './resolvers/youtube.ts'
import type { CacheItem, FetchLike, FollowedResource, Geography, ParsedItem, ResourceKind } from './types.ts'

export type CrawlOptions = {
  fetcher?: FetchLike
  now?: () => Date
}

export async function crawlResource(resource: FollowedResource, options: CrawlOptions = {}): Promise<CacheItem[]> {
  const fetcher = options.fetcher ?? fetch
  const fetchedAt = (options.now ?? (() => new Date()))().toISOString()
  const resolvedUrl = await resolveResourceUrl(resource.url, fetcher)
  const res = await fetcher(resolvedUrl, {
    headers: {
      'User-Agent': 'HermesFollowAnything/1.0',
      Accept: 'application/atom+xml,application/rss+xml,text/html,text/calendar,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.text()
  const contentType = res.headers.get('content-type')
  const parsed = parseFetchedBody(body, contentType, resolvedUrl, resource.kind)

  return parsed.map((raw) => {
    const item: CacheItem = {
      stable_key: '',
      record_type: 'item',
      resource_name: resource.name,
      resource_url: resource.url,
      fetched_at: fetchedAt,
      item_type: raw.item_type ?? resource.kind,
      title: raw.title,
      external_url: raw.external_url,
      canonical_url: raw.canonical_url,
      published_at: raw.published_at,
      event_start_at: raw.event_start_at,
      event_end_at: raw.event_end_at,
      location_text: raw.location_text,
      summary: raw.summary,
      semantic_tags: resource.semantic_tags ?? [],
      geography: resource.geography ?? inferGeography(`${raw.title ?? ''} ${raw.summary ?? ''} ${raw.location_text ?? ''}`),
    }
    item.stable_key = buildStableKey(item)
    return item
  })
}

export async function resolveResourceUrl(url: string, fetcher: FetchLike = fetch): Promise<string> {
  if (isYouTubeFeedUrl(url) || isYouTubeChannelUrl(url)) return resolveYouTubeFeedUrl(url, fetcher)
  if (isApplePodcastUrl(url)) return resolveApplePodcastFeedUrl(url, fetcher)
  return url
}

export function parseFetchedBody(body: string, contentType: string | null, url: string, fallbackType: ResourceKind): ParsedItem[] {
  if (looksLikeIcal(contentType, body)) return parseIcal(body)
  if (looksLikeFeed(contentType, body)) return parseFeed(body, fallbackType)
  return parseHtml(body, url).items
}

function inferGeography(text: string): Geography | null {
  const checks: Array<[RegExp, Geography]> = [
    [/\bSan Francisco\b|\bSF\b/i, { city: 'San Francisco', region: 'California', country: 'United States', scope: 'local', source: 'ai', confidence: 0.75 }],
    [/\bNew York\b|\bNYC\b/i, { city: 'New York', region: 'New York', country: 'United States', scope: 'local', source: 'ai', confidence: 0.75 }],
    [/\bLondon\b/i, { city: 'London', country: 'United Kingdom', scope: 'local', source: 'ai', confidence: 0.7 }],
    [/\bParis\b/i, { city: 'Paris', country: 'France', scope: 'local', source: 'ai', confidence: 0.7 }],
  ]
  return checks.find(([pattern]) => pattern.test(text))?.[1] ?? null
}
