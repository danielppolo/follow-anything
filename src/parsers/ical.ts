import type { ParsedItem } from '../types.ts'

export function looksLikeIcal(contentType: string | null, body: string): boolean {
  return (contentType ?? '').includes('text/calendar') || /BEGIN:VCALENDAR/i.test(body)
}

export function parseIcal(text: string): ParsedItem[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []
  return blocks.map((block) => ({
    item_type: 'event',
    title: icalField(block, 'SUMMARY') || '(Untitled event)',
    external_url: icalField(block, 'URL'),
    canonical_url: icalField(block, 'UID') || icalField(block, 'URL'),
    published_at: parseIcalDate(icalField(block, 'DTSTAMP') || icalField(block, 'CREATED')),
    event_start_at: parseIcalDate(icalField(block, 'DTSTART')),
    event_end_at: parseIcalDate(icalField(block, 'DTEND')),
    location_text: icalField(block, 'LOCATION'),
    summary: icalField(block, 'DESCRIPTION'),
  }))
}

function icalField(block: string, field: string): string | null {
  const match = block.match(new RegExp(`^${field}(?:;[^:]*)?:(.*)$`, 'mi'))
  return match ? unescapeIcal(match[1].trim()) : null
}

function parseIcalDate(value: string | null): string | null {
  if (!value) return null
  const normalized = value.replace(/Z$/, '')
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/)
  if (!match) return value
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`
}

function unescapeIcal(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}
