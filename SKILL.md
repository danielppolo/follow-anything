---
name: follow-anything
description: Follow websites, RSS/Atom feeds, podcasts, YouTube channels, iCal calendars, and generic pages using a local Hermes YAML resources file plus append-only JSONL cache.
---

# Follow Anything

Use this skill when Hermes needs to follow, refresh, remove, or query local subscriptions for websites, feeds, podcasts, YouTube channels, iCal event calendars, or generic pages.

Default data files:

- Resources: `~/.hermes/data/follow-anything/resources.yaml`
- Cache: `~/.hermes/data/follow-anything/fetched-results.jsonl`
- Installed wrapper: `~/.hermes/skills/follow-anything/scripts/follow-anything.ts`

Run commands with the skill directory wrapper path:

```bash
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts --help
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts list
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts add --name "ODC Calendar" --url "https://odc.dance/calendar" --kind event --tags dance,performance,calendar --city "San Francisco" --region "California" --country "United States"
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts remove --name "ODC Calendar"
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts crawl
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts refresh
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts query --tag dance --city "San Francisco"
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts query --kind event --from 2026-01-01 --to 2026-12-31 --json
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts repair
```

Use `--resources PATH` and `--cache PATH` for alternate files, especially in tests or one-off projects.

## Resource Rules

Resources are stored under `resources:` in YAML. Use `kind` for the resource's expected item type: `article`, `event`, `mixed`, `podcast`, or `video`. The CLI also accepts `--type` as an alias.

Keep `semantic_tags` lowercase and non-geographic. Put location facts in `geography` using `city`, `region`, `country`, and `scope`. When the user provides geography, treat it as authoritative and store `geography.source: "user"` with confidence `1`.

## Crawl Rules

Default crawl behavior is append-only. Do not overwrite existing JSONL records. Append a new item when the stable key has not been seen before. Append a `record_type: "revision"` record when title, URL, date, event time, location, or summary changes for an existing stable key.

Use cached results as fallback context when fetching fails. Do not use Supabase, Next.js app code, or external databases from this skill.

Built-in resolvers convert YouTube channel URLs to YouTube Atom feeds when a channel ID is available, including `/channel/UC...`, `@handle` by fetching the page and extracting a channel ID, and existing YouTube feed URLs. Apple Podcasts URLs resolve to podcast RSS feed URLs through the iTunes Lookup API when available.

## Query Rules

`query` filters cached latest records by `--tag`, `--city`, `--region`, `--country`, `--kind` or `--type`, `--source`, `--from`, `--to`, and `--limit`. Use `--json` when Hermes needs structured output for follow-up reasoning.

Cache records include `stable_key`, `record_type`, `resource_name`, `resource_url`, `fetched_at`, `item_type`, `title`, `external_url`, `canonical_url`, `published_at`, `event_start_at`, `event_end_at`, `location_text`, `summary`, `semantic_tags`, and `geography`.
