import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CacheItem, MergeResult, QueryOptions } from './types.ts'
import { DEFAULT_CACHE_FILE } from './yaml.ts'

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function resourceSlug(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}

export function buildStableKey(item: Omit<CacheItem, 'stable_key'> | CacheItem): string {
  const canonical = item.canonical_url || item.external_url
  if (item.item_type === 'event' && item.title && item.event_start_at) {
    return `event:${resourceSlug(item.resource_url)}:${slug(item.title)}:${slug(item.event_start_at)}`
  }
  if (canonical) return `${item.item_type}:${canonical}`
  const date = item.published_at || item.event_start_at || 'undated'
  return `${item.item_type}:${resourceSlug(item.resource_url)}:${slug(item.title ?? 'untitled')}:${slug(date)}`
}

export function mergeFetchedItems(existing: CacheItem[], fetched: CacheItem[]): MergeResult {
  const latestByKey = new Map<string, CacheItem>()
  for (const item of existing) {
    const key = item.stable_key || buildStableKey(item)
    latestByKey.set(key, { ...item, stable_key: key })
  }

  const itemsToAppend: CacheItem[] = []
  let newCount = 0
  let revisionCount = 0
  let unchangedCount = 0

  for (const rawItem of fetched) {
    const item: CacheItem = {
      ...rawItem,
      stable_key: rawItem.stable_key || buildStableKey(rawItem),
      record_type: rawItem.record_type ?? 'item',
    }
    const prior = latestByKey.get(item.stable_key)
    if (!prior) {
      itemsToAppend.push(item)
      latestByKey.set(item.stable_key, item)
      newCount++
      continue
    }

    const changedFields = meaningfulChangedFields(prior, item)
    if (changedFields.length === 0) {
      unchangedCount++
      continue
    }
    const revision: CacheItem = {
      ...item,
      record_type: 'revision',
      revision_of: prior.stable_key,
      changed_fields: changedFields,
    }
    itemsToAppend.push(revision)
    latestByKey.set(item.stable_key, revision)
    revisionCount++
  }

  return { itemsToAppend, newCount, revisionCount, unchangedCount }
}

export function queryCachedItems(items: CacheItem[], options: QueryOptions): CacheItem[] {
  const newest = latestItems(items)
  const filtered = newest.filter((item) => {
    if (options.semanticTag && !(item.semantic_tags ?? []).some((tag) => same(tag, options.semanticTag!))) return false
    if (options.city && !same(item.geography?.city, options.city)) return false
    if (options.region && !same(item.geography?.region, options.region)) return false
    if (options.country && !same(item.geography?.country, options.country)) return false
    const requestedType = options.kind ?? options.type
    if (requestedType && !same(item.item_type, String(requestedType))) return false
    if (options.source && !matchesSource(item, options.source)) return false
    const date = item.event_start_at || item.published_at
    if (options.from && date && date < options.from) return false
    if (options.to && date && date > options.to) return false
    return true
  })
  return options.limit ? filtered.slice(0, options.limit) : filtered
}

export function latestItems(items: CacheItem[]): CacheItem[] {
  const byKey = new Map<string, CacheItem>()
  for (const item of items) {
    const key = item.stable_key || buildStableKey(item)
    byKey.set(key, { ...item, stable_key: key })
  }
  return Array.from(byKey.values())
    .filter((item) => item.record_type !== 'revision' || item.revision_of)
    .sort((a, b) => String(b.event_start_at || b.published_at || b.fetched_at).localeCompare(String(a.event_start_at || a.published_at || a.fetched_at)))
}

export function loadCache(path = DEFAULT_CACHE_FILE): CacheItem[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CacheItem)
}

export function appendCache(path: string, items: CacheItem[]): void {
  if (items.length === 0) return
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${items.map((item) => JSON.stringify(item)).join('\n')}\n`)
}

export function repairCache(path: string): number {
  const items = latestItems(loadCache(path)).map((item) => ({
    ...item,
    record_type: 'item' as const,
    revision_of: undefined,
    changed_fields: undefined,
  }))
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : ''))
  renameSync(tmp, path)
  return items.length
}

function meaningfulChangedFields(a: CacheItem, b: CacheItem): string[] {
  const fields: Array<keyof CacheItem> = [
    'title',
    'external_url',
    'canonical_url',
    'published_at',
    'event_start_at',
    'event_end_at',
    'location_text',
    'summary',
  ]
  return fields.filter((field) => (a[field] ?? null) !== (b[field] ?? null)) as string[]
}

function same(a: string | undefined | null, b: string): boolean {
  return (a ?? '').toLowerCase() === b.toLowerCase()
}

function matchesSource(item: CacheItem, source: string): boolean {
  const needle = source.toLowerCase()
  return item.resource_name.toLowerCase().includes(needle) || item.resource_url.toLowerCase().includes(needle)
}
