import { describe, expect, it } from 'vitest'
import { parseResourcesYaml, serializeResourcesYaml } from '../src/yaml.ts'

describe('resources yaml', () => {
  it('roundtrips Hermes resource fields', () => {
    const yaml = serializeResourcesYaml([{
      name: 'ODC Calendar',
      url: 'https://odc.dance/calendar',
      kind: 'event',
      type: 'event',
      mode: 'listing',
      with_details: true,
      max_details: 5,
      semantic_tags: ['dance', 'performance'],
      geography: {
        city: 'San Francisco',
        region: 'California',
        country: 'United States',
        scope: 'local',
        source: 'user',
        confidence: 1,
      },
    }])

    const parsed = parseResourcesYaml(yaml)
    expect(parsed.resources).toHaveLength(1)
    expect(parsed.resources[0]).toMatchObject({
      name: 'ODC Calendar',
      kind: 'event',
      semantic_tags: ['dance', 'performance'],
      geography: { city: 'San Francisco', source: 'user', confidence: 1 },
    })
  })

  it('accepts legacy type-only resources', () => {
    const parsed = parseResourcesYaml('resources:\n  - name: "Feed"\n    url: "https://example.com/rss"\n    type: podcast\n')
    expect(parsed.resources[0].kind).toBe('podcast')
  })
})
