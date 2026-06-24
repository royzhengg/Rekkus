# Search Entities

> **All search tables are derived. Never treat as authoritative. Rebuild from source tables when stale. Never patch index or cache rows directly.**

## Tables

- `place_search_index`: derived full-text and vector search index over places. Rebuilt from `places`, `place_taxonomies`, `place_traits`, `place_aliases`.
- `place_popularity_cache`: rolling popularity score per place. Derived from interaction signals. Stale by design.
- `place_taxonomies`: cuisine and category classifications. Source table; also consumed by search ranking.
- `place_traits`: freeform attribute tags. Source table; feeds search facets.
- `dish_embeddings`: vector embeddings for dishes. Append-only; new embedding supersedes previous.
- `post_embeddings`: vector embeddings for posts. Append-only.
- `search_analytics`: immutable log of search queries, result counts, and click events. Never update or delete rows.

Note: a `place_embeddings` table may exist; confirm against `supabase/schema/` before referencing.

## Ownership

- **Services**: `lib/services/places.ts` (search functions: text search, nearby, semantic), `lib/services/places/queries.ts` (`listNearbyPlaces`, `getPlaceWithStats`).
- **ADRs**: schema-first development (ADR-023) and search ranking decisions documented in `docs/adr/`. Check ADR index for search-related entries.
