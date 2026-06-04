import { resolve } from 'node:path'
import { appendCache, loadCache, mergeFetchedItems, queryCachedItems, repairCache } from './cache.ts'
import { crawlResource } from './crawler.ts'
import type { FollowedResource, ResourceKind } from './types.ts'
import { DEFAULT_CACHE_FILE, DEFAULT_RESOURCES_FILE, loadResources, normalizeGeography, normalizeKind, writeResources } from './yaml.ts'

type Args = Record<string, string | boolean>

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)
  const command = String(args.command ?? 'help')
  if (args.help || command === 'help' || command === '--help') {
    printHelp()
    return
  }

  const resourcesPath = resolvePath(String(args.resources ?? DEFAULT_RESOURCES_FILE))
  const cachePath = resolvePath(String(args.cache ?? DEFAULT_CACHE_FILE))

  if (command === 'list') {
    const { resources } = loadResources(resourcesPath)
    if (args.json) {
      console.log(JSON.stringify(resources, null, 2))
      return
    }
    for (const resource of resources) {
      const geo = resource.geography?.city || resource.geography?.region || resource.geography?.country || 'no geography'
      console.log(`${resource.name} <${resource.url}> [${resource.kind}] ${geo}`)
    }
    return
  }

  if (command === 'add') {
    const name = value(args.name)
    const url = value(args.url)
    if (!name || !url) throw new Error('add requires --name and --url')
    const data = loadResources(resourcesPath)
    const kind = normalizeKind(args.kind ?? args.type)
    const resource: FollowedResource = {
      name,
      url,
      kind,
      type: kind,
      mode: normalizeMode(args.mode),
      with_details: booleanArg(args['with-details'] ?? args.with_details),
      max_details: numberArg(args['max-details'] ?? args.max_details, 3),
      semantic_tags: splitCsv(args['semantic-tags'] ?? args.semantic_tags ?? args.tags),
      geography: normalizeGeography({
        city: args.city,
        region: args.region,
        country: args.country,
        scope: args.scope,
        source: args.city || args.region || args.country || args.scope ? 'user' : undefined,
        confidence: args.city || args.region || args.country || args.scope ? 1 : undefined,
      }),
    }
    writeResources(resourcesPath, [...data.resources.filter((r) => r.url !== url && r.name !== name), resource])
    console.log(`Added ${name}`)
    return
  }

  if (command === 'remove') {
    const name = value(args.name)
    const url = value(args.url)
    if (!name && !url) throw new Error('remove requires --name or --url')
    const data = loadResources(resourcesPath)
    const next = data.resources.filter((r) => !((name && r.name === name) || (url && r.url === url)))
    writeResources(resourcesPath, next)
    console.log(`Removed ${data.resources.length - next.length} resource(s)`)
    return
  }

  if (command === 'query') {
    const results = queryCachedItems(loadCache(cachePath), {
      semanticTag: value(args.tag ?? args['semantic-tag'] ?? args['semantic-tags']),
      city: value(args.city),
      region: value(args.region),
      country: value(args.country),
      type: value(args.type) as ResourceKind | undefined,
      kind: value(args.kind) as ResourceKind | undefined,
      source: value(args.source),
      from: value(args.from),
      to: value(args.to),
      limit: numberArg(args.limit, 0) || undefined,
    })
    if (args.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }
    for (const item of results) {
      console.log(`${item.event_start_at ?? item.published_at ?? item.fetched_at} ${item.title ?? '(untitled)'} (${item.resource_name})`)
    }
    return
  }

  if (command === 'repair') {
    const count = repairCache(cachePath)
    console.log(`Reindexed ${count} cached item(s)`)
    return
  }

  if (command !== 'crawl' && command !== 'refresh') throw new Error(`Unknown command: ${command}`)

  const existing = loadCache(cachePath)
  const resources = loadResources(resourcesPath).resources.filter((resource) => {
    if (args.name && resource.name !== String(args.name)) return false
    if (args.tag && !(resource.semantic_tags ?? []).includes(String(args.tag).toLowerCase())) return false
    if (args.city && resource.geography?.city?.toLowerCase() !== String(args.city).toLowerCase()) return false
    if (args.region && resource.geography?.region?.toLowerCase() !== String(args.region).toLowerCase()) return false
    if (args.country && resource.geography?.country?.toLowerCase() !== String(args.country).toLowerCase()) return false
    const requestedType = args.kind ?? args.type
    if (requestedType && resource.kind !== normalizeKind(requestedType)) return false
    return true
  })

  const fetched = []
  const failures: string[] = []
  for (const resource of resources) {
    try {
      const items = await crawlResource(resource)
      fetched.push(...items)
      console.log(`${resource.name}: fetched ${items.length} item(s)`)
    } catch (error) {
      failures.push(`${resource.name}: ${error instanceof Error ? error.message : String(error)}`)
      const fallbackCount = existing.filter((item) => item.resource_url === resource.url).length
      console.log(`${resource.name}: fetch failed, ${fallbackCount} cached fallback item(s) available`)
    }
  }

  const merged = mergeFetchedItems(existing, fetched)
  appendCache(cachePath, merged.itemsToAppend)
  console.log(`Appended ${merged.newCount} new item(s), ${merged.revisionCount} revision(s), ${merged.unchangedCount} unchanged.`)
  if (failures.length) {
    console.log('Failures:')
    for (const failure of failures) console.log(`- ${failure}`)
  }
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? 'help' }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2)
    if (inlineValue != null) args[rawKey] = inlineValue
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[rawKey] = argv[++i]
    else args[rawKey] = true
  }
  return args
}

export function printHelp(): void {
  console.log(`follow-anything

Commands:
  list      List followed resources
  add       Add or replace a followed resource
  remove    Remove by --name or --url
  crawl     Fetch resources and append new cache records
  refresh   Alias for crawl
  query     Query cached records
  repair    Reindex latest cache records

Common options:
  --resources PATH  Default: ~/.hermes/data/follow-anything/resources.yaml
  --cache PATH      Default: ~/.hermes/data/follow-anything/fetched-results.jsonl
  --json            Emit JSON for list/query

Add options:
  --name --url --kind/--type article|event|mixed|podcast|video
  --tags/--semantic-tags csv --city --region --country --scope
  --mode listing|detail|both --with-details --max-details N

Query filters:
  --tag --city --region --country --kind/--type --source --from --to --limit N
`)
}

function splitCsv(value: unknown): string[] {
  return typeof value === 'string' ? value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : []
}

function value(input: unknown): string | undefined {
  return typeof input === 'string' && input.length > 0 ? input : undefined
}

function booleanArg(input: unknown): boolean {
  return input === true || input === 'true' || input === '1'
}

function numberArg(input: unknown, fallback: number): number {
  const parsed = Number(input ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeMode(value: unknown): 'listing' | 'detail' | 'both' {
  return value === 'detail' || value === 'both' ? value : 'listing'
}

function resolvePath(path: string): string {
  return path.startsWith('~') ? resolve(`${process.env.HOME ?? '.'}${path.slice(1)}`) : resolve(path)
}
