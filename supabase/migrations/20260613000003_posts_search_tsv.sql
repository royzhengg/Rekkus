-- Add a stored search_tsv generated column to posts so that GIN-indexed
-- full-text search replaces the per-row inline tsvector construction that
-- currently forces a sequential scan on every search call.
--
-- dishes already uses this pattern (search_tsv GENERATED ALWAYS AS ... STORED).
-- posts was missing it.
--
-- The column covers: must_order (A), dish_tags json text (A), cuisine_type (B),
-- caption (C). occasion_tags is excluded because array_to_string/array_out are
-- STABLE (not IMMUTABLE) and cannot be used in generated column expressions.
-- Hashtag names remain a join-time enrichment in search functions.

alter table public.posts
  add column if not exists search_tsv tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(must_order, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(dish_tags::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(cuisine_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(caption, '')), 'C')
  ) stored;

-- Replace the old functional expression index with a GIN index on the stored column.
drop index if exists public.posts_search_tsv_idx;

create index if not exists posts_search_tsv_gin
  on public.posts using gin (search_tsv);
