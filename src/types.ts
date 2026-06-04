export type ResourceKind = 'article' | 'event' | 'mixed' | 'podcast' | 'video'
export type ResourceMode = 'listing' | 'detail' | 'both'
export type RecordType = 'item' | 'revision'

export type Geography = {
  city?: string
  region?: string
  country?: string
  scope?: string
  source?: 'user' | 'ai' | 'unknown'
  confidence?: number
}

export type FollowedResource = {
  name: string
  url: string
  kind: ResourceKind
  type?: ResourceKind
  mode?: ResourceMode
  with_details?: boolean
  max_details?: number
  semantic_tags?: string[]
  geography?: Geography | null
}

export type ResourcesFile = {
  resources: FollowedResource[]
}

export type ParsedItem = {
  item_type: ResourceKind
  title: string | null
  external_url: string | null
  canonical_url: string | null
  published_at: string | null
  event_start_at: string | null
  event_end_at: string | null
  location_text: string | null
  summary: string | null
}

export type CacheItem = ParsedItem & {
  stable_key: string
  record_type?: RecordType
  resource_name: string
  resource_url: string
  fetched_at: string
  semantic_tags: string[]
  geography: Geography | null
  revision_of?: string
  changed_fields?: string[]
}

export type QueryOptions = {
  semanticTag?: string
  city?: string
  region?: string
  country?: string
  type?: ResourceKind | string
  kind?: ResourceKind | string
  source?: string
  from?: string
  to?: string
  limit?: number
}

export type MergeResult = {
  itemsToAppend: CacheItem[]
  newCount: number
  revisionCount: number
  unchangedCount: number
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
