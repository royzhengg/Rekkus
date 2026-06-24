# Search Invariants

## Product Invariants

- Rekkus is food-first and discovery-first, not dish-first.
- Search helps people decide what to eat and where to go.
- Dishes, places, collections, posts, and people are first-class result entities.
- Occasions are first-class discovery intents.
- Result relevance is intent-led and ranking-led, not hardcoded in the client.
- Empty query means discovery state, not failed search.
- Search never requests GPS automatically.
- Search remains usable with location disabled.
- Empty states always provide recovery actions.

## Ownership Invariants

- Filtering is server-owned.
- Ranking is server-owned.
- Collection ordering is server-owned.
- Suggestion base ranking is server-owned; client recency and saved-search boosts must stay bounded.
- Discovery module ordering is product-owned.
- Client ranking and client collection ordering are prohibited.
- Discovery modules are independently ranked; modules do not share a global ranking score.

## Taxonomy Invariants

- Search never reads `taxonomy_suggestions`.
- Search only reads accepted taxonomy assignments.
- Ranking never uses taxonomy confidence.
- Taxonomy aliases are owned by taxonomy.
- Search may consume aliases; search may not create aliases.

## Data Invariants

Business invariants belong in the database where possible.

- `place_search_index` is derived — always rebuild from source tables when stale. Never patch index rows directly to fix a data issue.
- `place_popularity_cache` is a cache, not a source of truth. Stale scores are expected between refresh runs. Authoritative interaction counts are in `place_stats`.
- `dish_embeddings` and `post_embeddings` are append-only. Never update an embedding row. Insert a new row; query logic selects the most recent embedding per entity.
- Ranking signals must be documented in `docs/domains/search/invariants.md` (this file) before their weights are changed in production SQL.
- `search_analytics` rows are immutable. Never update or delete them. They are the audit trail for search quality analysis.
- Text search and semantic search are complementary — neither is authoritative. A place absent from the vector index is still discoverable via text search and vice versa.
- `place_taxonomies` and `place_traits` are source tables that feed the search index. Changes to them should trigger an index update via trigger or rebuild job.
- Taxonomy acceptance gate (B-625): Search functions must only query `place_taxonomies_accepted`, never `place_taxonomies` or `taxonomy_suggestions` directly. The accepted view filters `confidence_score >= 0.50 AND removed_at IS NULL`. Confidence is used for acceptance gating only — it is never a ranking signal. See [taxonomy-assignment.md](taxonomy-assignment.md) and [ADR-0031](../../adr/ADR-0031-taxonomy-assignment-pipeline.md).

## Documented Ranking Signals

_(Add signal name, weight rationale, and ADR reference here before shipping a ranking change.)_
