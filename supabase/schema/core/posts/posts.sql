-- Domain: Core
-- Owner: Content
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- posts
create table if not exists public.posts (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        references public.users on delete cascade not null,
  place_id        uuid        references public.places on delete set null,
  caption         text,
  rating          integer     check (rating between 1 and 5),
  food_rating     integer     check (food_rating between 1 and 5),
  vibe_rating     integer     check (vibe_rating between 1 and 5),
  cost_rating     integer     check (cost_rating between 1 and 4),
  cuisine_type    text,
  must_order      text,
  dish_tags       jsonb,
  dish_id         uuid        references public.dishes(id) on delete set null,
  taste_verdict   text        check (taste_verdict is null or taste_verdict in (
                                'not_for_me', 'good', 'craveable', 'must_order', 'worth_a_trip')),
  value_verdict   text        check (value_verdict is null or value_verdict in (
                                'not_worth_it', 'fair', 'great_value', 'worth_the_splurge')),
  occasion_tags   text[]      not null default '{}',
  deleted_at      timestamptz,
  deleted_reason  text,
  last_edited_at  timestamptz,
  edit_count      integer     not null default 0,
  search_tsv      tsvector    generated always as (
    setweight(to_tsvector('simple', coalesce(must_order, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(dish_tags::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(cuisine_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(caption, '')), 'C')
  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists posts_not_deleted_idx on public.posts (created_at desc) where deleted_at is null;
create index if not exists posts_must_order_trgm_idx on public.posts using gin (must_order extensions.gin_trgm_ops);
create index if not exists posts_search_tsv_gin on public.posts using gin (search_tsv);
create index if not exists posts_taste_verdict_idx on public.posts (taste_verdict);
create index if not exists posts_dish_id_idx on public.posts (dish_id) where dish_id is not null;
