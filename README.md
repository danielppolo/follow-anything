# follow-anything

A standalone Hermes skill for following websites, RSS/Atom feeds, podcasts, YouTube channels, iCal calendars, and generic pages.

## Install

Build and run from this repository for now:

```bash
npm install
npm test
node --experimental-strip-types scripts/follow-anything.ts --help
```

When installed as a Hermes skill, commands should use:

```bash
node --experimental-strip-types ~/.hermes/skills/follow-anything/scripts/follow-anything.ts list
```

## Data Files

Defaults:

- `~/.hermes/data/follow-anything/resources.yaml`
- `~/.hermes/data/follow-anything/fetched-results.jsonl`

Override either path:

```bash
node --experimental-strip-types scripts/follow-anything.ts list --resources /tmp/resources.yaml
node --experimental-strip-types scripts/follow-anything.ts query --cache /tmp/fetched-results.jsonl --json
```

## Commands

```bash
node --experimental-strip-types scripts/follow-anything.ts list
node --experimental-strip-types scripts/follow-anything.ts add --name "Example Feed" --url "https://example.com/feed.xml" --kind article --tags tech,research
node --experimental-strip-types scripts/follow-anything.ts add --name "Events" --url "https://example.com/calendar.ics" --type event --city "San Francisco" --region "California" --country "United States"
node --experimental-strip-types scripts/follow-anything.ts remove --name "Example Feed"
node --experimental-strip-types scripts/follow-anything.ts crawl
node --experimental-strip-types scripts/follow-anything.ts refresh
node --experimental-strip-types scripts/follow-anything.ts query --tag tech --limit 10
node --experimental-strip-types scripts/follow-anything.ts query --kind event --from 2026-01-01 --to 2026-12-31 --json
node --experimental-strip-types scripts/follow-anything.ts repair
```

`add` supports `--kind`/`--type`, `--tags`/`--semantic-tags`, `--city`, `--region`, `--country`, `--scope`, `--mode`, `--with-details`, and `--max-details`.

`query` supports `--tag`, `--city`, `--region`, `--country`, `--kind`/`--type`, `--source`, `--from`, `--to`, `--limit`, and `--json`.

## Cache Behavior

The cache is append-only JSONL. New stable keys append item records. Meaningful changes for an existing stable key append `record_type: "revision"` records instead of overwriting prior records.

Stable keys prefer:

- event title plus event start time plus resource URL for events
- canonical or external URL for articles, podcasts, and videos
- title plus date plus resource URL as a fallback

## Tests

```bash
npm test
npm test
```
