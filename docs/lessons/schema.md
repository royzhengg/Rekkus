# Schema Architecture Lessons

## Stored generated columns are the right FTS pattern

`dishes` already used `search_tsv GENERATED ALWAYS AS ... STORED` with a GIN index. Posts had an inline expression index (`CREATE INDEX ... ON posts USING GIN (to_tsvector(...))`) which forced a sequential scan on every search call because the query used `to_tsvector(...)` in the WHERE clause — not the index expression.

**Rule**: stored generated column + `CREATE INDEX ... USING GIN (column_name)` — callers reference the column name directly, which the planner can satisfy from the index. A functional expression index only helps if the WHERE clause uses the exact same expression, which is fragile.

**`jsonb_to_tsvector`** is the right way to index JSONB string values in a generated column — it handles JSONB `"string"` values directly without a subquery or unnesting.

## Two FKs with identical semantics = guaranteed divergence

`comments.parent_id` and `comments.parent_comment_id` were two columns with the same FK target and the same meaning. No constraint prevented them diverging on the same row. The right fix is: migrate, then drop. Don't leave both and promise to keep them in sync in code.

## Write-only columns are dead weight

8 Google detail columns on `restaurants` (`phone`, `website`, `business_status`, `opening_hours`, etc.) were written in every upsert but never read in any SELECT. The same data was already in `restaurant_provider_cache.normalized_payload`. Conclusion: when a column has zero read paths, it is a bug waiting to happen (the two copies can silently diverge). Drop it.

**How to find write-only columns**: grep the codebase for all `select` strings and column references; grep for the column name in write paths. If the only hits are INSERT/UPDATE, it is a candidate for removal if the data lives elsewhere.

## Side-table pattern for large infrequently-read columns

`posts.embedding` (384-dim vector, ~1.5 kB per row) inflated every heap page on the posts table — a high-write, high-read table used for feeds, profiles, and search. Moving it to `post_embeddings(post_id, embedding)` as a 1:1 side-table means:
- The posts heap page stays small → better buffer cache hit rate on non-semantic reads
- The HNSW index sits on a purpose-built table with no competing columns
- Pattern mirrors `restaurant_provider_cache` already used for restaurants

**When to use side-table pattern**: when a column is large (vectors, full text), accessed only by a specific code path, and the main table is on the hot read path for other purposes.

## Respect ADRs — even when the architecture review disagrees

The architecture review recommended unifying 7 audit tables into a single `audit_events` table. ADR 0011 (accepted 2026-05-26) explicitly rejected this approach with clear reasoning: domain-scoped RLS guarantees would break, append-only enforcement per domain would be lost, and centralised insert routing adds a single point of failure. The revisit trigger is 12 arms; we have 7.

**Rule**: when an architecture recommendation contradicts an existing ADR, read the ADR first. Only supersede it if the friction is real enough to justify the change now — not because the theoretical diagram looks cleaner.

## `conversation_participants` split increases, not decreases, schema complexity

Splitting request/preference columns into separate tables sounds clean but: the request columns (`request_status`, `requested_by`) are used as membership guards in 20+ SQL functions. Splitting them forces every RLS policy and function to JOIN two tables. The schema visualizer would gain 2 new nodes and many new edges. Deferred until there is a clear product trigger (e.g., request lifecycle requires its own audit log or the preferences table needs per-row RLS independent of membership).
