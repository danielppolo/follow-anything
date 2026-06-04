import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { FollowedResource, Geography, ResourceKind, ResourceMode, ResourcesFile } from './types.ts'

export const DEFAULT_DATA_DIR = `${process.env.HOME ?? '.'}/.hermes/data/follow-anything`
export const DEFAULT_RESOURCES_FILE = `${DEFAULT_DATA_DIR}/resources.yaml`
export const DEFAULT_CACHE_FILE = `${DEFAULT_DATA_DIR}/fetched-results.jsonl`

const KINDS: ResourceKind[] = ['article', 'event', 'mixed', 'podcast', 'video']
const MODES: ResourceMode[] = ['listing', 'detail', 'both']

export function parseResourcesYaml(yaml: string): ResourcesFile {
  const resources: FollowedResource[] = []
  let current: Record<string, unknown> | null = null
  let inGeography = false

  for (const rawLine of yaml.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '')
    if (!withoutComment.trim() || withoutComment.trim() === 'resources:') continue

    const resourceMatch = withoutComment.match(/^\s*-\s+([a-zA-Z_][\w-]*):\s*(.*)$/)
    if (resourceMatch) {
      if (current) resources.push(normalizeResource(current))
      current = {}
      inGeography = false
      current[resourceMatch[1]] = parseScalar(resourceMatch[2])
      continue
    }

    const keyValue = withoutComment.match(/^(\s+)([a-zA-Z_][\w-]*):\s*(.*)$/)
    if (!keyValue || !current) continue
    const indent = keyValue[1].length
    const key = keyValue[2]
    const value = keyValue[3]

    if (indent === 4 && key === 'geography') {
      current.geography = {}
      inGeography = true
      continue
    }
    if (indent >= 6 && inGeography) {
      ;(current.geography as Record<string, unknown>)[key] = parseScalar(value)
      continue
    }
    if (indent === 4) {
      inGeography = false
      current[key] = parseScalar(value)
    }
  }

  if (current) resources.push(normalizeResource(current))
  return { resources }
}

export function serializeResourcesYaml(resources: FollowedResource[]): string {
  const lines = ['resources:']
  for (const resource of resources) {
    const kind = normalizeKind(resource.kind ?? resource.type)
    lines.push(`  - name: ${quoteYaml(resource.name)}`)
    lines.push(`    url: ${quoteYaml(resource.url)}`)
    lines.push(`    kind: ${kind}`)
    lines.push(`    type: ${kind}`)
    lines.push(`    mode: ${resource.mode ?? 'listing'}`)
    lines.push(`    with_details: ${Boolean(resource.with_details)}`)
    lines.push(`    max_details: ${resource.max_details ?? 3}`)
    lines.push(`    semantic_tags: [${(resource.semantic_tags ?? []).map(quoteYaml).join(', ')}]`)
    if (resource.geography) {
      lines.push('    geography:')
      for (const key of ['city', 'region', 'country', 'scope', 'source'] as const) {
        const value = resource.geography[key]
        if (value != null) lines.push(`      ${key}: ${quoteYaml(String(value))}`)
      }
      if (resource.geography.confidence != null) lines.push(`      confidence: ${resource.geography.confidence}`)
    }
  }
  return `${lines.join('\n')}\n`
}

export function loadResources(path = DEFAULT_RESOURCES_FILE): ResourcesFile {
  if (!existsSync(path)) return { resources: [] }
  return parseResourcesYaml(readFileSync(path, 'utf8'))
}

export function writeResources(path: string, resources: FollowedResource[]): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serializeResourcesYaml(resources))
  renameSync(tmp, path)
}

export function normalizeResource(input: Record<string, unknown>): FollowedResource {
  if (typeof input.name !== 'string' || typeof input.url !== 'string') {
    throw new Error('Each resource must include string name and url fields.')
  }
  const kind = normalizeKind(input.kind ?? input.type)
  const mode = MODES.includes(input.mode as ResourceMode) ? input.mode as ResourceMode : 'listing'
  return {
    name: input.name,
    url: input.url,
    kind,
    type: kind,
    mode,
    with_details: Boolean(input.with_details),
    max_details: typeof input.max_details === 'number' ? input.max_details : 3,
    semantic_tags: normalizeTags(input.semantic_tags),
    geography: normalizeGeography(input.geography),
  }
}

export function normalizeGeography(value: unknown): Geography | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const geography: Geography = {}
  for (const key of ['city', 'region', 'country', 'scope'] as const) {
    if (typeof raw[key] === 'string' && raw[key]) geography[key] = raw[key] as string
  }
  geography.source = raw.source === 'user' || raw.source === 'ai' ? raw.source : 'unknown'
  if (typeof raw.confidence === 'number') geography.confidence = raw.confidence
  return Object.keys(geography).length > 0 ? geography : null
}

export function normalizeKind(value: unknown): ResourceKind {
  return KINDS.includes(value as ResourceKind) ? value as ResourceKind : 'article'
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
}

function parseScalar(value: string): string | number | boolean | string[] | null {
  const trimmed = value.trim()
  if (trimmed === 'null' || trimmed === '~') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const body = trimmed.slice(1, -1).trim()
    if (!body) return []
    return body.split(',').map((part) => unquote(part.trim())).filter(Boolean)
  }
  return unquote(trimmed)
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return trimmed
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
