import type { FetchLike } from '../types.ts'

const CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{20,}$/

export function isYouTubeFeedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('youtube.com') && parsed.pathname === '/feeds/videos.xml' && parsed.searchParams.has('channel_id')
  } catch {
    return false
  }
}

export function isYouTubeChannelUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return /(^|\.)youtube\.com$/.test(parsed.hostname) && (
      parsed.pathname.startsWith('/channel/') ||
      parsed.pathname.startsWith('/@') ||
      parsed.pathname.startsWith('/c/') ||
      parsed.pathname.startsWith('/user/')
    )
  } catch {
    return false
  }
}

export async function resolveYouTubeFeedUrl(url: string, fetcher: FetchLike = fetch): Promise<string> {
  if (isYouTubeFeedUrl(url)) return url
  const direct = extractChannelIdFromUrl(url)
  if (direct) return feedUrlForChannelId(direct)
  if (!isYouTubeChannelUrl(url)) return url

  const res = await fetcher(url, {
    headers: { 'User-Agent': 'HermesFollowAnything/1.0' },
  })
  if (!res.ok) throw new Error(`Failed to fetch YouTube channel page: HTTP ${res.status}`)
  const html = await res.text()
  const channelId = extractChannelId(html)
  if (!channelId) throw new Error(`Could not extract YouTube channel ID from ${url}`)
  return feedUrlForChannelId(channelId)
}

export function extractChannelIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const match = parsed.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function extractChannelId(html: string): string | null {
  const patterns = [
    /"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/,
    /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/,
    /"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/,
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1] && CHANNEL_ID_RE.test(match[1])) return match[1]
  }
  return null
}

function feedUrlForChannelId(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}
