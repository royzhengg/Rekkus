-- B-545: Add top_dishes to restaurant search RPCs
-- Surfaces the 2–3 most-posted dish names per restaurant on search result cards.
-- Derived from posts.dish_id → dishes.name, aggregated by count, capped at 3.
-- Index coverage: posts_restaurant_id_idx + posts_dish_id_idx already exist.

-- =============================================================================
-- Section A: search_restaurants_full_text — add top_dishes text[]
-- =============================================================================

-- Must drop before recreating; CREATE OR REPLACE cannot change return type.
drop function if exists public.search_restaurants_full_text(text, integer, double precision, double precision, text);

create function public.search_restaurants_full_text(
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
  open_now boolean, rank real, top_dishes text[]
)
language sql stable as $$
with normalized as (
  select
    trim(coalesce(query_text, '')) as raw_query,
    websearch_to_tsquery('simple', coalesce(query_text, '')) as query,
    case
      when trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g')) = ''
      then null::tsquery
      else to_tsquery('simple',
        replace(
          trim(regexp_replace(
            regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9\s]', '', 'g'),
            '\s+', ' ', 'g'
          )),
          ' ', ':* & '
        ) || ':*'
      )
    end as prefix_query,
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
    greatest(
      ts_rank(
        to_tsvector('simple',
          coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
          coalesce(r.suburb,'') || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.address,'')
        ),
        normalized.query
      ),
      case
        when normalized.prefix_query is not null
        then ts_rank(
          to_tsvector('simple',
            coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
            coalesce(r.suburb,'') || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.address,'')
          ),
          normalized.prefix_query
        ) * 0.8
        else 0.0
      end
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
      or (
        normalized.prefix_query is not null
        and to_tsvector('simple',
          coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
          coalesce(r.suburb,'') || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.address,'')
        ) @@ normalized.prefix_query
      )
      or lower(coalesce(r.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
)
select
  ranked.id, ranked.name, ranked.address, ranked.city, ranked.suburb,
  ranked.cuisine_type, ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.rank,
  array(
    select d.name
    from public.posts p
    join public.dishes d on d.id = p.dish_id
    where p.restaurant_id = ranked.id
      and p.dish_id is not null
      and p.deleted_at is null
    group by d.name
    order by count(*) desc
    limit 3
  ) as top_dishes
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- =============================================================================
-- Section B: restaurants_in_bounding_box — add top_dishes text[]
-- =============================================================================

-- Must drop before recreating; CREATE OR REPLACE cannot change return type.
drop function if exists public.restaurants_in_bounding_box(double precision, double precision, double precision, double precision, integer);

create function public.restaurants_in_bounding_box(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  max_results integer default 50
)
returns table (
  id uuid, name text, address text, city text, cuisine_type text,
  google_place_id text, latitude double precision, longitude double precision,
  google_rating double precision, google_review_count integer,
  open_now boolean, top_dishes text[]
)
language sql stable as $$
select
  r.id, r.name, r.address, r.city, r.cuisine_type, r.google_place_id,
  r.latitude, r.longitude, r.google_rating::double precision,
  r.google_review_count, r.open_now,
  array(
    select d.name
    from public.posts p
    join public.dishes d on d.id = p.dish_id
    where p.restaurant_id = r.id
      and p.dish_id is not null
      and p.deleted_at is null
    group by d.name
    order by count(*) desc
    limit 3
  ) as top_dishes
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
limit greatest(1, least(coalesce(max_results, 50), 200));
$$;
