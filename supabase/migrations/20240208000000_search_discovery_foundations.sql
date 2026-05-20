create extension if not exists postgis with schema extensions;

alter table public.restaurants
  add column if not exists open_now boolean,
  add column if not exists open_now_checked_at timestamptz;

alter table public.restaurants
  add column if not exists restaurant_geog extensions.geography(Point, 4326)
  generated always as (
    case
      when latitude is null or longitude is null then null
      else extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored;

create index if not exists restaurants_search_tsv_idx on public.restaurants using gin (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(cuisine_type, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(address, '')
  )
);

create index if not exists posts_search_tsv_idx on public.posts using gin (
  to_tsvector(
    'simple',
    coalesce(caption, '') || ' ' ||
    coalesce(best_dish, '') || ' ' ||
    coalesce(cuisine_type, '')
  )
);

create index if not exists users_search_tsv_idx on public.users using gin (
  to_tsvector('simple', coalesce(username, '') || ' ' || coalesce(full_name, ''))
);

create index if not exists restaurants_lat_lng_idx on public.restaurants (latitude, longitude)
where latitude is not null and longitude is not null;

create index if not exists restaurants_geog_gist_idx on public.restaurants
using gist (restaurant_geog)
where restaurant_geog is not null;

create table if not exists public.cuisine_aliases (
  cuisine_type text not null,
  alias text not null,
  created_at timestamptz not null default now(),
  primary key (cuisine_type, alias)
);

alter table public.cuisine_aliases enable row level security;

do $$
begin
  create policy "Anyone can view cuisine aliases"
    on public.cuisine_aliases for select
    using (true);
exception
  when duplicate_object then null;
end $$;

insert into public.cuisine_aliases (cuisine_type, alias) values
  ('american', 'burger'),
  ('american', 'bbq'),
  ('asian', 'dumpling'),
  ('asian', 'noodle'),
  ('australian', 'brunch'),
  ('bakery', 'pastry'),
  ('cafe', 'coffee'),
  ('cafe', 'brunch'),
  ('chinese', 'dim sum'),
  ('chinese', 'wonton'),
  ('french', 'croissant'),
  ('greek', 'souvlaki'),
  ('indian', 'curry'),
  ('indian', 'biryani'),
  ('indonesian', 'rendang'),
  ('italian', 'pizza'),
  ('italian', 'pasta'),
  ('japanese', 'ramen'),
  ('japanese', 'sushi'),
  ('korean', 'kimchi'),
  ('mexican', 'taco'),
  ('middle eastern', 'falafel'),
  ('spanish', 'tapas'),
  ('thai', 'pad thai'),
  ('turkish', 'kebab'),
  ('vietnamese', 'pho'),
  ('vietnamese', 'banh mi')
on conflict do nothing;

create or replace function public.search_restaurants_full_text(
  query_text text,
  max_results integer default 20
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  cuisine_type text,
  google_place_id text,
  latitude double precision,
  longitude double precision,
  google_rating double precision,
  google_review_count integer,
  open_now boolean,
  rank real
)
language sql
stable
as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query
),
alias_matches as (
  select distinct cuisine_type
  from public.cuisine_aliases, normalized
  where alias <> ''
    and to_tsvector('simple', alias) @@ normalized.query
),
ranked as (
  select
    r.*,
    ts_rank(
      to_tsvector(
        'simple',
        coalesce(r.name, '') || ' ' ||
        coalesce(r.cuisine_type, '') || ' ' ||
        coalesce(r.city, '') || ' ' ||
        coalesce(r.address, '')
      ),
      normalized.query
    ) as rank
  from public.restaurants r
  cross join normalized
  where normalized.raw_query <> ''
    and (
      to_tsvector(
        'simple',
        coalesce(r.name, '') || ' ' ||
        coalesce(r.cuisine_type, '') || ' ' ||
        coalesce(r.city, '') || ' ' ||
        coalesce(r.address, '')
      ) @@ normalized.query
      or lower(coalesce(r.cuisine_type, '')) in (select cuisine_type from alias_matches)
    )
)
select
  ranked.id,
  ranked.name,
  ranked.address,
  ranked.city,
  ranked.cuisine_type,
  ranked.google_place_id,
  ranked.latitude,
  ranked.longitude,
  ranked.google_rating::double precision,
  ranked.google_review_count,
  ranked.open_now,
  ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

create or replace function public.restaurants_in_bounding_box(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  max_results integer default 50
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  cuisine_type text,
  google_place_id text,
  latitude double precision,
  longitude double precision,
  google_rating double precision,
  google_review_count integer,
  open_now boolean
)
language sql
stable
as $$
select
  r.id,
  r.name,
  r.address,
  r.city,
  r.cuisine_type,
  r.google_place_id,
  r.latitude,
  r.longitude,
  r.google_rating::double precision,
  r.google_review_count,
  r.open_now
from public.restaurants r
where r.latitude between least(min_lat, max_lat) and greatest(min_lat, max_lat)
  and r.longitude between least(min_lng, max_lng) and greatest(min_lng, max_lng)
  and (
    r.restaurant_geog is null
    or extensions.ST_Intersects(
      r.restaurant_geog::extensions.geometry,
      extensions.ST_MakeEnvelope(
        least(min_lng, max_lng),
        least(min_lat, max_lat),
        greatest(min_lng, max_lng),
        greatest(min_lat, max_lat),
        4326
      )
    )
  )
order by r.name asc
limit greatest(1, least(coalesce(max_results, 50), 100));
$$;
