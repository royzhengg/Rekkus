-- Domain: Core
-- Owner: Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- dishes
create table if not exists public.dishes (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  name_normalized text        generated always as (lower(trim(name))) stored,
  place_id        uuid        references public.places(id) on delete set null,
  cuisine_type    text,
  created_by      uuid        references public.users(id) on delete set null,
  search_tsv      tsvector    generated always as (
                                to_tsvector('english', coalesce(name, ''))
                              ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- saved_dishes
create table if not exists public.saved_dishes (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users(id) on delete cascade not null,
  dish_id    uuid        references public.dishes(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

-- Indexes
create unique index if not exists dishes_name_place_uniq on public.dishes (name_normalized, place_id);
create index if not exists dishes_name_trgm_idx on public.dishes using gin (name extensions.gin_trgm_ops);
create index if not exists dishes_search_tsv_idx on public.dishes using gin (search_tsv);
create index if not exists dishes_place_id_idx on public.dishes (place_id);
create index if not exists dishes_not_deleted_idx on public.dishes (place_id, created_at desc) where deleted_at is null;

create index if not exists saved_dishes_user_created_idx on public.saved_dishes (user_id, created_at desc);
create index if not exists saved_dishes_dish_idx on public.saved_dishes (dish_id);
