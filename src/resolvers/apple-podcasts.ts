import type { FetchLike } from '../types.ts'

export function isApplePodcastUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    return hostname === 'podcasts.apple.com' && /\/id\d+/.test(pathname)
  } catch {
    return false
  }
}

export function extractPodcastId(url: string): string | null {
  try {
    return new URL(url).pathname.match(/\/id(\d+)/)?.[1] ?? null
  } catch {
    return null
  }
}

export async function resolveApplePodcastFeedUrl(url: string, fetcher: FetchLike = fetch): Promise<string> {
  if (!isApplePodcastUrl(url)) return url
  const id = extractPodcastId(url)
  if (!id) throw new Error(`Cannot extract podcast ID from URL: ${url}`)
  const res = await fetcher(`https://itunes.apple.com/lookup?id=${id}&entity=podcast`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`iTunes Lookup API returned ${res.status}`)
  const json = await res.json() as { results?: Array<{ feedUrl?: string }> }
  const feedUrl = json.results?.[0]?.feedUrl
  if (!feedUrl) throw new Error(`No feedUrl in iTunes Lookup response for podcast ${id}`)
  return feedUrl
}
