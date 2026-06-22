-- Vector search redesign: dish embeddings side table + drop legacy FTS RPCs.
--
-- Why a side table: matches post_embeddings pattern — keeps dishes heap small
-- and lets the HNSW index sit on a purpose-built table.
--
-- Legacy RPCs removed here: search_places_full_text, search_posts_full_text,
-- search_posts_by_dish, search_dishes_full_text, expand_search_cuisines,
-- get_personalized_suggestions. Replaced by search_semantic in next migration.
-- suggest_searches is kept (typeahead prefix matching is unaffected).

-- ---------------------------------------------------------------------------
-- dish_embeddings side table
-- ---------------------------------------------------------------------------

create table if not exists public.dish_embeddings (
  dish_id        uuid primary key references public.dishes(id) on delete cascade,
  embedding      extensions.vector(384) not null,
  embedding_hash text,
  updated_at     timestamptz default now()
);

create index if not exists dish_embeddings_hnsw
  on public.dish_embeddings using hnsw (embedding extensions.vector_cosine_ops);

alter table public.dish_embeddings enable row level security;

drop policy if exists "anyone authenticated can view dish embeddings" on public.dish_embeddings;
create policy "anyone authenticated can view dish embeddings"
  on public.dish_embeddings for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Drop legacy FTS RPCs
-- ---------------------------------------------------------------------------

drop function if exists public.search_places_full_text(text, integer, double precision, double precision, text);
drop function if exists public.search_posts_full_text(text, integer, integer, double precision, double precision);
drop function if exists public.search_posts_by_dish(text, double precision, double precision, integer);
drop function if exists public.search_dishes_full_text(text, double precision, double precision, integer);
drop function if exists public.expand_search_cuisines(text, integer);
drop function if exists public.get_personalized_suggestions(uuid, text, integer);
