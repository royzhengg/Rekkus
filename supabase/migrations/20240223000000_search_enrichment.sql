-- Search Enrichment: pg_trgm, suburb tables, weighted FTS, dish RPC, autocomplete, popularity cache
-- Depends on: 20240221000000_search_improvements.sql

-- =============================================================================
-- Section A: pg_trgm + suburb tables + suburb data backfill
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- suburb_aliases: curated abbreviations ('cbd', 'darlo', 'parra')
create table if not exists public.suburb_aliases (
  id serial primary key,
  alias text not null unique,
  canonical_name text not null,
  lat double precision,
  lng double precision
);

alter table public.suburb_aliases enable row level security;

create policy "Anyone can read suburb_aliases"
  on public.suburb_aliases for select using (true);

insert into public.suburb_aliases (alias, canonical_name) values
  ('cbd', 'Sydney CBD'), ('city', 'Sydney CBD'), ('the city', 'Sydney CBD'),
  ('circular quay', 'Sydney CBD'), ('sydney city', 'Sydney CBD'),
  ('darlo', 'Darlinghurst'), ('paddo', 'Paddington'), ('chippen', 'Chippendale'),
  ('marrick', 'Marrickville'), ('parra', 'Parramatta'), ('cabra', 'Cabramatta'),
  ('surry', 'Surry Hills'), ('sh', 'Surry Hills'), ('newtown', 'Newtown'),
  ('bondi', 'Bondi'), ('manly', 'Manly'), ('crows nest', 'Crows Nest'),
  ('glebe', 'Glebe'), ('leichhardt', 'Leichhardt'), ('balmain', 'Balmain'),
  ('redfern', 'Redfern'), ('waterloo', 'Waterloo'), ('zetland', 'Zetland'),
  ('mascot', 'Mascot'), ('randwick', 'Randwick'), ('coogee', 'Coogee'),
  ('maroubra', 'Maroubra'), ('chatswood', 'Chatswood'), ('artarmon', 'Artarmon'),
  ('lane cove', 'Lane Cove'), ('north sydney', 'North Sydney'),
  ('mosman', 'Mosman'), ('cremorne', 'Cremorne'), ('neutral bay', 'Neutral Bay'),
  ('kirribilli', 'Kirribilli'), ('pyrmont', 'Pyrmont'), ('ultimo', 'Ultimo'),
  ('haymarket', 'Haymarket'), ('chinatown', 'Haymarket'),
  ('darling harbour', 'Darling Harbour'), ('dh', 'Darling Harbour'),
  ('kings cross', 'Kings Cross'), ('potts point', 'Potts Point'),
  ('woolloomooloo', 'Woolloomooloo'), ('edgy', 'Edgecliff'),
  ('double bay', 'Double Bay'), ('rose bay', 'Rose Bay'),
  ('vaucluse', 'Vaucluse'), ('watsons bay', 'Watsons Bay'),
  ('strathfield', 'Strathfield'), ('burwood', 'Burwood'),
  ('hurstville', 'Hurstville'), ('kogarah', 'Kogarah'),
  ('penrith', 'Penrith'), ('blacktown', 'Blacktown'),
  ('castle hill', 'Castle Hill'), ('hornsby', 'Hornsby'),
  ('dee why', 'Dee Why'), ('narrabeen', 'Narrabeen'),
  ('freshwater', 'Freshwater'), ('collaroy', 'Collaroy')
on conflict (alias) do nothing;

-- suburb_lookups: comprehensive AU locality list (seeded separately)
create table if not exists public.suburb_lookups (
  id serial primary key,
  name text not null,
  state text,
  postcode text,
  lat double precision,
  lng double precision
);

create unique index if not exists suburb_lookups_name_state_uidx
  on public.suburb_lookups (lower(name), coalesce(state, ''));

alter table public.suburb_lookups enable row level security;

create policy "Anyone can read suburb_lookups"
  on public.suburb_lookups for select using (true);

create index if not exists suburb_lookups_name_trgm_idx
  on public.suburb_lookups using gin (name extensions.gin_trgm_ops);

create index if not exists suburb_lookups_lower_name_idx
  on public.suburb_lookups (lower(name));

-- Older local/dev schemas may not have a suburb column yet; keep this
-- migration additive and self-contained before building suburb search.
alter table public.restaurants
  add column if not exists suburb text;

-- Backfill suburb from address for rows where suburb is null but address has pattern
update public.restaurants
set suburb = trim((regexp_match(address, ',\s*([A-Za-z ]+)\s+[A-Z]{2,3}\s+\d{4}'))[1])
where suburb is null
  and address is not null
  and (regexp_match(address, ',\s*([A-Za-z ]+)\s+[A-Z]{2,3}\s+\d{4}')) is not null;

-- Index for direct suburb equality filtering
create index if not exists idx_restaurants_suburb_lower
  on public.restaurants (lower(suburb))
  where suburb is not null;

-- resolve_suburb_query: 3-tier fuzzy suburb resolution
create or replace function public.resolve_suburb_query(input_text text)
returns table (canonical_suburb text, confidence real, lat double precision, lng double precision)
language sql stable as $$
  select canonical_name::text, 1.0::real, sa.lat, sa.lng
  from public.suburb_aliases sa
  where sa.alias = lower(trim(input_text))

  union all

  select sl.name::text,
    extensions.similarity(lower(sl.name), lower(trim(input_text)))::real,
    sl.lat, sl.lng
  from public.suburb_lookups sl
  where extensions.similarity(lower(sl.name), lower(trim(input_text))) > 0.45

  union all

  select distinct r.suburb::text,
    extensions.similarity(lower(r.suburb), lower(trim(input_text)))::real,
    null::double precision, null::double precision
  from public.restaurants r
  where r.suburb is not null
    and extensions.similarity(lower(r.suburb), lower(trim(input_text))) > 0.45

  order by 2 desc
  limit 5;
$$;

-- =============================================================================
-- Section B: Rebuild restaurant FTS index to include suburb + trgm indexes
-- =============================================================================

drop index if exists public.restaurants_search_tsv_idx;

create index restaurants_search_tsv_idx on public.restaurants using gin (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(cuisine_type, '') || ' ' ||
    coalesce(suburb, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(address, '')
  )
);

create index if not exists restaurants_name_trgm_idx
  on public.restaurants using gin (name extensions.gin_trgm_ops);

create index if not exists posts_best_dish_trgm_idx
  on public.posts using gin (best_dish extensions.gin_trgm_ops)
  where best_dish is not null;

-- =============================================================================
-- Section C: Rebuild posts GIN index to include dish_tags names
-- =============================================================================

drop index if exists public.posts_search_tsv_idx;

create index posts_search_tsv_idx on public.posts using gin (
  to_tsvector('simple',
    coalesce(caption, '') || ' ' ||
    coalesce(best_dish, '') || ' ' ||
    coalesce(cuisine_type, '')
  )
);

-- =============================================================================
-- Section D: search_restaurants_full_text with suburb_filter
-- =============================================================================

create or replace function public.search_restaurants_full_text(
  query_text text,
  max_results integer default 20,
  near_lat double precision default null,
  near_lng double precision default null,
  suburb_filter text default null
)
returns table (
  id uuid, name text, address text, city text, suburb text,
  cuisine_type text, google_place_id text,
  latitude double precision, longitude double precision,
  google_rating double precision, google_review_count integer,
  open_now boolean, rank real
)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
alias_matches as (
  select distinct cuisine_type
  from public.cuisine_aliases, normalized
  where alias <> '' and to_tsvector('simple', alias) @@ normalized.query
),
ranked as (
  select r.*,
    ts_rank(
      to_tsvector('simple',
        coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
        coalesce(r.suburb,'') || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.address,'')
      ), normalized.query
    ) * case
      when normalized.ref_point is null or r.restaurant_geog is null then 1.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from public.restaurants r cross join normalized
  where normalized.raw_query <> ''
    and (suburb_filter is null or lower(r.suburb) = lower(suburb_filter))
    and (
      to_tsvector('simple',
        coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
        coalesce(r.suburb,'') || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.address,'')
      ) @@ normalized.query
      or lower(coalesce(r.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
)
select ranked.id, ranked.name, ranked.address, ranked.city, ranked.suburb,
  ranked.cuisine_type, ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- =============================================================================
-- Section E1: search_posts_full_text with weighted fields (A/B/C/D)
-- =============================================================================

create or replace function public.search_posts_full_text(
  query_text text,
  max_results integer default 20,
  offset_val integer default 0,
  near_lat double precision default null,
  near_lng double precision default null
)
returns table (id uuid, rank real)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
dish_tag_text as (
  select p.id,
    coalesce(
      string_agg(elem->>'name', ' ')
        filter (where elem->>'name' is not null),
      ''
    ) as tag_names
  from public.posts p,
    jsonb_array_elements(coalesce(p.dish_tags, '[]'::jsonb)) as elem
  group by p.id
),
hashtag_text as (
  select ph.post_id as id, string_agg(h.name, ' ') as ht_names
  from public.post_hashtags ph
  join public.hashtags h on h.id = ph.hashtag_id
  group by ph.post_id
),
weighted as (
  select p.id,
    setweight(
      to_tsvector('simple', coalesce(p.best_dish,'') || ' ' || coalesce(dt.tag_names,'')),
      'A'
    ) ||
    setweight(
      to_tsvector('simple', coalesce(p.cuisine_type,'') || ' ' || coalesce(ht.ht_names,'')),
      'B'
    ) ||
    setweight(to_tsvector('simple', coalesce(p.caption,'')), 'C') ||
    setweight(
      to_tsvector('simple', coalesce(array_to_string(p.occasion_tags::text[], ' '),'')),
      'D'
    ) as tsv
  from public.posts p
  left join dish_tag_text dt on dt.id = p.id
  left join hashtag_text ht on ht.id = p.id
  where p.deleted_at is null
)
select
  w.id,
  ts_rank_cd(w.tsv, normalized.query) * case
    when normalized.ref_point is null or r.restaurant_geog is null then 1.0
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500  then 2.0
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000 then 1.5
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000 then 1.25
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000 then 1.1
    else 1.0
  end as rank
from weighted w
cross join normalized
left join public.posts p on p.id = w.id
left join public.restaurants r on r.id = p.restaurant_id
where normalized.raw_query <> ''
  and w.tsv @@ normalized.query
order by rank desc, p.created_at desc
limit greatest(1, least(coalesce(max_results, 20), 50))
offset greatest(0, coalesce(offset_val, 0));
$$;

-- =============================================================================
-- Section E2: search_posts_by_dish — dish-intent path with trgm fallback
-- =============================================================================

create or replace function public.search_posts_by_dish(
  dish_query text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 20
)
returns table (id uuid, rank real, match_source text)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(dish_query, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(dish_query, '')) as query,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
dish_tag_text as (
  select p.id,
    coalesce(
      string_agg(elem->>'name', ' ')
        filter (where elem->>'name' is not null),
      ''
    ) as tag_names
  from public.posts p,
    jsonb_array_elements(coalesce(p.dish_tags, '[]'::jsonb)) as elem
  where p.deleted_at is null
  group by p.id
),
fts_results as (
  select
    p.id,
    ts_rank_cd(
      setweight(to_tsvector('simple', coalesce(p.best_dish,'') || ' ' || coalesce(dt.tag_names,'')), 'A'),
      normalized.query
    ) * case
      when normalized.ref_point is null or r.restaurant_geog is null then 1.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank,
    'fts'::text as match_source
  from public.posts p
  cross join normalized
  left join dish_tag_text dt on dt.id = p.id
  left join public.restaurants r on r.id = p.restaurant_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and setweight(to_tsvector('simple', coalesce(p.best_dish,'') || ' ' || coalesce(dt.tag_names,'')), 'A')
        @@ normalized.query
),
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.best_dish,'')), lower(normalized.raw_query)) * case
      when normalized.ref_point is null or r.restaurant_geog is null then 1.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500  then 2.0
      else 1.0
    end as rank,
    'trgm'::text as match_source
  from public.posts p
  cross join normalized
  left join public.restaurants r on r.id = p.restaurant_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and p.best_dish is not null
    and extensions.similarity(lower(p.best_dish), lower(normalized.raw_query)) > 0.25
    and not exists (select 1 from fts_results f where f.id = p.id)
)
select id, rank, match_source from fts_results
union all
select id, rank, match_source from trgm_results
order by rank desc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- =============================================================================
-- Section F: suggest_searches — prefix autocomplete (< 50ms target)
-- =============================================================================

create or replace function public.suggest_searches(
  prefix_query text,
  near_lat double precision default null,
  near_lng double precision default null,
  limit_per_type integer default 3
)
returns table (
  suggestion_type text,
  display_text text,
  secondary_text text,
  entity_id uuid,
  score real
)
language sql stable as $$
with prefix as (
  select
    trim(coalesce(prefix_query, '')) as raw,
    case
      when near_lat is not null and near_lng is not null
      then extensions.ST_SetSRID(
        extensions.ST_MakePoint(near_lng, near_lat), 4326
      )::extensions.geography
      else null
    end as ref_point
),
restaurant_matches as (
  select
    'restaurant'::text as suggestion_type,
    r.name as display_text,
    coalesce(r.cuisine_type, r.city, '') as secondary_text,
    r.id as entity_id,
    ts_rank(
      to_tsvector('simple',
        coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
        coalesce(r.suburb,'') || ' ' || coalesce(r.city,'')
      ),
      to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
    ) * case
      when prefix.ref_point is null or r.restaurant_geog is null then 1.0
      when extensions.ST_Distance(r.restaurant_geog, prefix.ref_point) < 1000 then 2.0
      when extensions.ST_Distance(r.restaurant_geog, prefix.ref_point) < 5000 then 1.5
      else 1.0
    end as score
  from public.restaurants r, prefix
  where prefix.raw <> ''
    and to_tsvector('simple',
      coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
      coalesce(r.suburb,'') || ' ' || coalesce(r.city,'')
    ) @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  order by score desc
  limit limit_per_type
),
dish_matches as (
  select
    'dish'::text as suggestion_type,
    p.best_dish as display_text,
    '' as secondary_text,
    null::uuid as entity_id,
    count(*)::real as score
  from public.posts p, prefix
  where prefix.raw <> ''
    and p.best_dish is not null
    and p.deleted_at is null
    and to_tsvector('simple', p.best_dish)
        @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  group by p.best_dish
  order by score desc
  limit limit_per_type
),
hashtag_matches as (
  select
    'hashtag'::text as suggestion_type,
    h.name as display_text,
    '' as secondary_text,
    null::uuid as entity_id,
    count(ph.post_id)::real as score
  from public.hashtags h
  cross join prefix
  left join public.post_hashtags ph on ph.hashtag_id = h.id
  where prefix.raw <> ''
    and to_tsvector('simple', h.name)
        @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  group by h.name
  order by score desc
  limit limit_per_type
)
select * from restaurant_matches
union all
select * from dish_matches
union all
select * from hashtag_matches
order by score desc;
$$;

-- =============================================================================
-- Section G: restaurant_popularity_cache
-- =============================================================================

create table if not exists public.restaurant_popularity_cache (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  post_count integer not null default 0,
  interaction_count_30d integer not null default 0,
  avg_food_rating numeric(3,2),
  food_rating_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.restaurant_popularity_cache enable row level security;

create policy "Anyone can view popularity cache"
  on public.restaurant_popularity_cache for select using (true);

create or replace function public.refresh_restaurant_popularity_cache()
returns void language sql security definer set search_path = public as $$
  insert into public.restaurant_popularity_cache (
    restaurant_id, post_count, interaction_count_30d,
    avg_food_rating, food_rating_count, updated_at
  )
  select
    r.id,
    count(distinct p.id)::integer,
    count(ae.id) filter (
      where ae.event_type in ('place_click','place_view')
        and ae.created_at >= now() - interval '30 days'
    )::integer,
    avg(p.food_rating) filter (where p.food_rating is not null),
    count(p.id) filter (where p.food_rating is not null)::integer,
    now()
  from public.restaurants r
  left join public.posts p on p.restaurant_id = r.id and p.deleted_at is null
  left join public.analytics_events ae on ae.entity_id = r.id
  group by r.id
  on conflict (restaurant_id) do update set
    post_count = excluded.post_count,
    interaction_count_30d = excluded.interaction_count_30d,
    avg_food_rating = excluded.avg_food_rating,
    food_rating_count = excluded.food_rating_count,
    updated_at = now();
$$;

-- Initial population
select public.refresh_restaurant_popularity_cache();
