# Search Invariants

Business invariants belong in the database where possible.

- `place_search_index` is derived — always rebuild from source tables when stale. Never patch index rows directly to fix a data issue.
- `place_popularity_cache` is a cache, not a source of truth. Stale scores are expected between refresh runs. Authoritative interaction counts are in `place_stats`.
- `dish_embeddings` and `post_embeddings` are append-only. Never update an embedding row. Insert a new row; query logic selects the most recent embedding per entity.
- Ranking signals must be documented in `docs/domains/search/invariants.md` (this file) before their weights are changed in production SQL.
- `search_analytics` rows are immutable. Never update or delete them. They are the audit trail for search quality analysis.
- Text search and semantic search are complementary — neither is authoritative. A place absent from the vector index is still discoverable via text search and vice versa.
- `place_taxonomies` and `place_traits` are source tables that feed the search index. Changes to them should trigger an index update via trigger or rebuild job.

## Documented Ranking Signals

_(Add signal name, weight rationale, and ADR reference here before shipping a ranking change.)_
