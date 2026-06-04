import { describe, expect, it } from 'vitest'
import { parseFeed } from '../src/parsers/feed.ts'
import { parseHtml } from '../src/parsers/html.ts'
import { parseIcal } from '../src/parsers/ical.ts'

describe('parsers', () => {
  it('parses RSS items', () => {
    const items = parseFeed(`<?xml version="1.0"?><rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Thu, 04 Jun 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Summary</p>]]></description></item></channel></rss>`)
    expect(items[0]).toMatchObject({
      title: 'Hello',
      canonical_url: 'https://example.com/hello',
      summary: 'Summary',
    })
  })

  it('parses Atom and YouTube video IDs', () => {
    const items = parseFeed(`<feed><entry><title>Video</title><yt:videoId>abc123</yt:videoId><published>2026-06-04T00:00:00Z</published><media:group><media:description>Desc</media:description></media:group></entry></feed>`)
    expect(items[0]).toMatchObject({
      item_type: 'video',
      canonical_url: 'https://www.youtube.com/watch?v=abc123',
    })
  })

  it('parses iCal VEVENT entries', () => {
    const items = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Show
DTSTART:20260604T190000Z
DTEND:20260604T210000Z
LOCATION:San Francisco
DESCRIPTION:An event
END:VEVENT
END:VCALENDAR`)
    expect(items[0]).toMatchObject({
      item_type: 'event',
      title: 'Show',
      event_start_at: '2026-06-04T19:00:00.000Z',
      location_text: 'San Francisco',
    })
  })

  it('parses HTML fallback and discovers feeds', () => {
    const result = parseHtml(`<html><head><title>Page</title><link rel="canonical" href="/page"><link rel="alternate" type="application/rss+xml" href="/feed.xml"><meta name="description" content="About"></head><body><p>Body</p></body></html>`, 'https://example.com/x')
    expect(result.items[0]).toMatchObject({
      title: 'Page',
      canonical_url: 'https://example.com/page',
      summary: 'About',
    })
    expect(result.discoveredFeeds).toEqual(['https://example.com/feed.xml'])
  })
})
