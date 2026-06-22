# ADR-021: OSM Place Import Strategy

**Status:** Accepted  
**Date:** 2026-06-22

## Context

Rekkus needs a place database before users can tag restaurants, cafes, and bars in their posts. Building one from scratch requires either paying for Google Places API at scale (~AUD $80k+ for 200k lookups) or sourcing a free, licenseable dataset. Users will not post if they can't find real venues in search results.

## Decision

Import all food and beverage venues in Australia from OpenStreetMap (OSM) as the seed dataset. OSM is licensed under the Open Database Licence (ODbL) — attribution required ("© OpenStreetMap contributors"), commercial use allowed.

## What OSM replaces vs. what we still need Google for

| Signal | Source after import |
|--------|-------------------|
| Name, address, suburb, city | OSM |
| Phone, website, socials | OSM |
| Cuisine, opening hours, features | OSM |
| Place type (amenity) | OSM |
| Ratings, review count | Rekkus community (no OSM equivalent) |
| Photos | User post photos |
| `google_place_id` | Kept for cross-reference + future enrichment |

## Schema decisions

### Identity model

All core entities use `id uuid primary key`. `osm_id` and `google_place_id` are cross-reference columns — not primary keys. The internal `place_id` survives provider changes, merges, and renames.

### Domain-owned tables (not a god table)

`places` stays at ~20 core identity columns forever. All provider metadata lives in narrowly-scoped domain tables:

| Table | Owner |
|-------|-------|
| `places` | identity + lifecycle |
| `place_contact` | contact enrichment |
| `place_features` | accessibility / dietary / facilities |
| `place_provider_metadata` | import/enrichment pipelines |
| `place_stats` | derived cache (events are truth) |
| `place_aliases` | search quality |
| `place_traits` | community vibes |
| `place_merge_log` | dedup history |
| `place_sources` | raw provider payloads |
| `place_opening_hours` | hours by source |
| `search_analytics` | query observability |
| `osm_import_runs` | import provenance |

### `verification_level` enum (single source of confidence)

`data_confidence_score` is NOT stored. It is derived at query time from `verification_level`:

```sql
case verification_level
  when 'user_created'       then 0.20
  when 'osm_only'           then 0.30
  when 'osm_google'         then 0.55
  when 'community_verified' then 0.75
  when 'owner_verified'     then 1.00
end
```

### OSM update rules (mandatory)

Future delta refresh runs MUST read `verification_level` before writing any field:

| Current level | OSM refresh allowed? |
|--------------|---------------------|
| `osm_only` | Yes — freely overwrite |
| `osm_google` | Yes — overwrite OSM-sourced fields only |
| `community_verified` | **No** — log delta, do NOT write |
| `owner_verified` | **No** — log delta, do NOT write |

This prevents "owner fixes hours → OSM overwrites them next week."

### JSONB rule

`raw_osm_tags`, `alt_names`, `payload` are archive fields. They MUST NOT appear in WHERE or ORDER BY clauses of production search queries. Extract values into typed columns at import time.

### Provenance: place-level today, field-level in future

`canonical_source` and `verification_level` are place-level today. Future architecture assumes field-level provenance (`field_verifications` table). This is a stepping stone — the current model is sufficient until owner claims and community editing go live.

## Import source

- Primary: Overpass API (`https://overpass-api.de/api/interpreter`)
- Cache: per-state JSON snapshots at `supabase/seeds/osm/<state>.json` (< 7 days old = skip fetch)
- Venue taxonomy: `amenity = restaurant|cafe|bar|pub|fast_food|ice_cream|food_court`, `shop = bakery|coffee|deli|confectionery|pastry`

## Duplicate detection

Per batch (500 rows), not per row. Uses a single `ST_DWithin` spatial JOIN (50m radius) + `pg_trgm` name similarity (> 0.75). Matches are logged to `restaurant_audit_events` as `potential_duplicate` and skipped on insert. Full canonicalisation engine is a backlog item.

## Attribution

All OSM-sourced rows have `canonical_source = 'osm'`. The app must display "© OpenStreetMap contributors" wherever OSM data appears in map or address contexts. Attribution string is stored in `COMPLIANCE.md`.

## Consequences

- ~80k–200k venues seeded with no per-lookup cost
- Users can immediately tag real venues in posts
- OSM data quality is variable (phone/website ~20–50% fill rate) — community corrections improve quality over time
- Future Google enrichment is user-tap-triggered only (not bulk) to control API costs
- `place_search_index` materialised table is the near-term priority to eliminate 7+ joins per search query
