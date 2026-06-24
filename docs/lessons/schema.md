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

## Generic taxonomy engine beats domain-specific duplication

When building the first classification system (cuisines), building a generic `taxonomy_nodes(slug, name, taxonomy_type, parent_id, path)` table with a `taxonomy_type` enum costs ~30% more upfront work but means every future classification (food categories, venue types, dietary tags, styles) reuses the same tables, helpers, and RLS policies. Domain-specific tables (`cuisines`, `food_categories`, etc.) would diverge within 2–3 migrations.

**Rule**: when the second use case is clearly foreseeable (even if deferred), build the generic version from the start — tables are harder to merge than to split.

## Materialised path beats recursive CTE for taxonomy hierarchy

Storing `path text` (e.g. `'asian/japanese'`) on each taxonomy node lets `get_taxonomy_family` and `get_taxonomy_ancestors` use `path LIKE prefix || '/%'` — a single indexed scan. A recursive CTE on `parent_id` requires a sequential scan per depth level. The tradeoff: path must be set by trigger on INSERT and is immutable (UPDATE raises exception). This is fine for reference data that changes only via migrations.

## Immutable reference tables need no `updated_at`

`taxonomy_nodes` is append-only — an UPDATE/DELETE trigger raises immediately. Shipping `updated_at` on such a table implies mutability that doesn't exist. Omit it and document the constraint clearly so callers don't expect it.

## Backfill and trigger must use identical split logic

When a trigger splits a compound value (e.g. `regexp_split_to_table(cuisine_slug, '\s*;\s*')`), the historical backfill must use the exact same expression. If the backfill uses a simpler path (e.g. treat the whole slug as a single value), places with compound slugs like `japanese;asian` will be silently under-mapped. Enforce this by code-reviewing the backfill against the trigger before running.

## Schema-first architecture: domain files are cheaper than migrations

When a schema grows beyond ~50 tables, a monolithic `schema.sql` becomes impossible to review and gradually drifts from the running database (tables added in migrations are never backported). The fix: split into domain files under `supabase/schema/`; generate `schema.sql` from them; enforce sync in CI.

**Key tradeoffs learned:**
- `schema.sql` must be *committed* (not gitignored) so `git diff` shows readable schema diffs on PRs. Gitignoring it removes the most useful review surface.
- The build script must emit section banners so humans can find tables in the generated file. Silent concatenation with no markers is unreadable.
- CI drift detection (`build-schema.sh | diff - schema.sql`) must run on every PR, not just main — schema edits happen on feature branches.

## Table naming conflicts when renaming entity prefixes

When renaming `restaurant_*` → `place_*`, two tables had name conflicts: `restaurant_sources` vs `place_sources` and `restaurant_aliases` vs `place_aliases`. They were *not* the same table — the `restaurant_*` variants were governance/audit tables with rights and provenance tracking; the `place_*` variants were simpler data caches.

**Rule**: before renaming a table family, read the column lists of both the old and new names. If they serve different purposes, pick a semantically distinct new name rather than merging. Merging dissimilar tables adds phantom nullable columns and obscures intent.

**Names chosen:**
- `restaurant_sources` → `place_provenance` (data rights/governance, distinct from `place_sources` payload cache)
- `restaurant_aliases` → `place_provider_links` (provider ID mappings, distinct from `place_aliases` search text aliases)

## place_owners vs place_ownership_events: canonical state vs audit log

Two separate tables are needed for ownership:
- `place_owners` — canonical *current* state (many-to-many, `PRIMARY KEY (place_id, owner_id)`)
- `place_ownership_events` — append-only *history* of what changed and when

The audit table must NOT reference canonical state (reverse reference creates circular dependency in rebuild order). The canonical table must NOT embed history. The audit table references the canonical table, not the reverse.
