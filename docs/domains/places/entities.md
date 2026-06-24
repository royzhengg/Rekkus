# Places Entities

## Tables

- `places`: canonical venue record. `status` is authoritative for open/closed state.
- `place_stats`: derived aggregate (post count, save count, avg rating). Never treat as source of truth.
- `place_contact`: phone, website, email for a place.
- `place_features`: amenity/feature flags (outdoor seating, takeaway, etc.).
- `place_opening_hours`: structured hours per day.
- `place_owners`: claimed ownership records.
- `place_closure_signals`: crowd-sourced closure votes. Signal count does not determine status.
- `place_observations`: point-in-time field observations (hours spotted, price seen). Append-only.
- `place_taxonomies`: cuisine and category classifications.
- `place_traits`: freeform attribute tags (vibe, dietary options, etc.).
- `place_provenance`: record of where data originated (provider, scrape, user).
- `place_aliases`: historical and alternate names. Retained after renames to preserve references.
- `place_search_index`: derived full-text + vector search index. Never patch directly.
- `place_popularity_cache`: rolling popularity score. Derived; stale by design.
- `place_provider_metadata`: raw metadata from external providers (Google, etc.).
- `place_provider_links`: cross-reference between Rekkus place and provider IDs.
- `place_provider_cache`: cached provider API responses.

## Ownership

- **Tables**: all tables listed above.
- **Services**: `lib/services/places/` (queries, mutations, cache, governance), `lib/services/places.ts` (search, enrichment, full service).
- **ADRs**: place authority model and schema-first development decisions documented in `docs/adr/`. Check ADR index for place-related entries.
