import { describe, expect, it } from 'vitest'
import { buildStableKey, mergeFetchedItems, queryCachedItems } from '../src/cache.ts'
import type { CacheItem } from '../src/types.ts'

const base: CacheItem = {
  stable_key: '',
  record_type: 'item',
  resource_name: 'Feed',
  resource_url: 'https://example.com/feed.xml',
  fetched_at: '2026-01-01T00:00:00.000Z',
  item_type: 'article',
  title: 'Post',
  external_url: 'https://example.com/post',
  canonical_url: 'https://example.com/post',
  published_at: '2026-01-01T00:00:00.000Z',
  event_start_at: null,
  event_end_at: null,
  location_text: null,
  summary: 'One',
  semantic_tags: ['tech'],
  geography: { city: 'San Francisco', country: 'United States' },
}
base.stable_key = buildStableKey(base)

describe('cache', () => {
  it('builds stable keys from canonical URLs', () => {
    expect(base.stable_key).toBe('article:https://example.com/post')
  })

  it('appends revisions when meaningful fields change', () => {
    const changed = { ...base, summary: 'Two', fetched_at: '2026-01-02T00:00:00.000Z' }
    const merged = mergeFetchedItems([base], [changed])
    expect(merged.newCount).toBe(0)
    expect(merged.revisionCount).toBe(1)
    expect(merged.itemsToAppend[0]).toMatchObject({
      record_type: 'revision',
      revision_of: base.stable_key,
      changed_fields: ['summary'],
    })
  })

  it('queries by tag, place, kind, source, date, and limit', () => {
    const results = queryCachedItems([base], {
      semanticTag: 'tech',
      city: 'San Francisco',
      kind: 'article',
      source: 'Feed',
      from: '2026-01-01',
      to: '2026-01-02',
      limit: 1,
    })
    expect(results).toHaveLength(1)
  })
})
