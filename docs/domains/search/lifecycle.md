# Search Lifecycle

## 1. Search Index Freshness

```text
place data written (insert/update to places, place_taxonomies, place_traits, place_aliases)
 └─ trigger fires
     └─ place_search_index row upserted (async or sync depending on trigger config)
         └─ index available for search queries

[on staleness / bulk change]
 └─ rebuild job runs (see runbooks)
     └─ place_search_index rebuilt from source tables
```

- Index rows are never patched directly. Rebuild is the remediation path.
- Staleness after bulk imports is expected; queries degrade gracefully to older index entries.

## 2. Embedding Freshness

```text
post or dish created
 └─ embedding job queued (background worker / Edge Function)
     └─ embedding computed (external model call)
         └─ dish_embeddings / post_embeddings row inserted (append-only)
             └─ semantic search queries pick up new embedding

[existing embedding superseded]
 └─ new embedding row inserted with later created_at
     └─ query logic uses most recent embedding per entity
```

- Embeddings are never updated in place — always append a new row.
- A gap between post creation and embedding availability is expected; text search covers the gap.

## 3. Popularity Cache Update

```text
interaction event recorded (post, reaction, save)
 └─ scheduled job runs (cadence: see ops config)
     └─ place_popularity_cache row updated with recalculated score
```

- Cache update is not real-time. Stale scores are expected between runs.
- Authoritative interaction counts live in `place_stats`, not the popularity cache.
