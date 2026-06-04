import { mkdtempSync, rmSync } from 'node:fs'
import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildStableKey } from '../src/cache.ts'
import { runCli } from '../src/cli.ts'
import type { CacheItem } from '../src/types.ts'

let dir: string
let logs: string[]

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'follow-anything-'))
  logs = []
  vi.spyOn(console, 'log').mockImplementation((line = '') => {
    logs.push(String(line))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

describe('cli', () => {
  it('adds and lists resources using temp files', async () => {
    const resources = join(dir, 'resources.yaml')
    await runCli(['add', '--resources', resources, '--name', 'Feed', '--url', 'https://example.com/rss.xml', '--kind', 'article', '--tags', 'Tech,AI', '--city', 'San Francisco'])
    await runCli(['list', '--resources', resources])
    expect(logs).toContain('Added Feed')
    expect(logs.some((line) => line.includes('Feed <https://example.com/rss.xml> [article] San Francisco'))).toBe(true)
  })

  it('queries cached items as JSON', async () => {
    const cache = join(dir, 'cache.jsonl')
    const item: CacheItem = {
      stable_key: '',
      record_type: 'item',
      resource_name: 'Feed',
      resource_url: 'https://example.com/rss.xml',
      fetched_at: '2026-06-04T00:00:00.000Z',
      item_type: 'article',
      title: 'Cached',
      external_url: 'https://example.com/cached',
      canonical_url: 'https://example.com/cached',
      published_at: '2026-06-04T00:00:00.000Z',
      event_start_at: null,
      event_end_at: null,
      location_text: null,
      summary: 'Summary',
      semantic_tags: ['tech'],
      geography: { city: 'San Francisco', country: 'United States' },
    }
    item.stable_key = buildStableKey(item)
    appendFileSync(cache, `${JSON.stringify(item)}\n`)

    await runCli(['query', '--cache', cache, '--tag', 'tech', '--city', 'San Francisco', '--json'])
    const parsed = JSON.parse(logs.at(-1) ?? '[]') as CacheItem[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('Cached')
  })
})
