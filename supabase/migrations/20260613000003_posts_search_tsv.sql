-- Add a stored search_tsv generated column to posts so that GIN-indexed
-- full-text search replaces the per-row inline tsvector construction that
-- currently forces a sequential scan on every search call.
--
-- dishes already uses this pattern (search_tsv GENERATED ALWAYS AS ... STORED).
-- posts was missing it.
--
-- The column covers: must_order (A), dish_tags json strings (A), cuisine_type (B),
-- caption (C), occasion_tags (D).  Hashtag names remain a join-time enrichment in
-- the search functions because they live in a separate table.

alter table public.posts
  add column if not exists search_tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(must_order, '')), 'A') ||
    setweight(jsonb_to_tsvector('simple', coalesce(dish_tags, '[]'::jsonb), '["string"]'), 'A') ||
    setweight(to_tsvector('simple', coalesce(cuisine_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(caption, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(occasion_tags, ' '), '')), 'D')
  ) stored;

-- Replace the old functional expression index with a GIN index on the stored column.
-- The stored column makes the index usable by queries that reference search_tsv directly.
drop index if exists public.posts_search_tsv_idx;

create index if not exists posts_search_tsv_gin
  on public.posts using gin (search_tsv);
