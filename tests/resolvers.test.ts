import { describe, expect, it } from 'vitest'
import { extractPodcastId, resolveApplePodcastFeedUrl } from '../src/resolvers/apple-podcasts.ts'
import { extractChannelId, resolveYouTubeFeedUrl } from '../src/resolvers/youtube.ts'

describe('resolvers', () => {
  it('resolves direct YouTube channel URLs without fetching', async () => {
    await expect(resolveYouTubeFeedUrl('https://www.youtube.com/channel/UC12345678901234567890ab')).resolves.toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC12345678901234567890ab')
  })

  it('extracts channel IDs from handle page HTML', async () => {
    const html = '{"externalId":"UCabcdefghijklmnopqrstuvwxyz"}'
    expect(extractChannelId(html)).toBe('UCabcdefghijklmnopqrstuvwxyz')
    const fetcher = async () => new Response(html, { status: 200 })
    await expect(resolveYouTubeFeedUrl('https://www.youtube.com/@example', fetcher)).resolves.toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuvwxyz')
  })

  it('resolves Apple Podcasts via mocked lookup', async () => {
    expect(extractPodcastId('https://podcasts.apple.com/us/podcast/show/id12345')).toBe('12345')
    const fetcher = async () => Response.json({ results: [{ feedUrl: 'https://example.com/podcast.xml' }] })
    await expect(resolveApplePodcastFeedUrl('https://podcasts.apple.com/us/podcast/show/id12345', fetcher)).resolves.toBe('https://example.com/podcast.xml')
  })
})
