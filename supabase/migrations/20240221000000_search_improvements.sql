-- Search improvements: geo-weighted restaurant FTS + posts FTS
-- Extends existing search_restaurants_full_text (migration 20240208) with optional GPS params.
-- Adds search_posts_full_text using existing posts_search_tsv_idx GIN index.

-- 9A: Geo-weighted restaurant FTS
create or replace function public.search_restaurants_full_text(
  query_text text,
  max_results integer default 20,
  near_lat double precision default null,
  near_lng double precision default null
)
returns table (
  id uuid, name text, address text, city text, cuisine_type text,
  google_place_id text, latitude double precision, longitude double precision,
  google_rating double precision, google_review_count integer, open_now boolean,
  rank real
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
        coalesce(r.city,'') || ' ' || coalesce(r.address,'')
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
    and (
      to_tsvector('simple',
        coalesce(r.name,'') || ' ' || coalesce(r.cuisine_type,'') || ' ' ||
        coalesce(r.city,'') || ' ' || coalesce(r.address,'')
      ) @@ normalized.query
      or lower(coalesce(r.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
)
select ranked.id, ranked.name, ranked.address, ranked.city, ranked.cuisine_type,
  ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- 9B: Posts FTS — returns (id, rank) only; caller fetches full post data via POST_SELECT
-- Uses existing GIN index posts_search_tsv_idx on caption || best_dish || cuisine_type
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
)
select
  p.id,
  ts_rank(
    to_tsvector('simple',
      coalesce(p.caption,'') || ' ' || coalesce(p.best_dish,'') || ' ' ||
      coalesce(p.cuisine_type,'')
    ), normalized.query
  ) * case
    when normalized.ref_point is null or r.restaurant_geog is null then 1.0
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500  then 2.0
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000 then 1.5
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000 then 1.25
    when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000 then 1.1
    else 1.0
  end as rank
from public.posts p
cross join normalized
left join public.restaurants r on r.id = p.restaurant_id
where normalized.raw_query <> ''
  and p.deleted_at is null
  and to_tsvector('simple',
    coalesce(p.caption,'') || ' ' || coalesce(p.best_dish,'') || ' ' ||
    coalesce(p.cuisine_type,'')
  ) @@ normalized.query
order by rank desc, p.created_at desc
limit greatest(1, least(coalesce(max_results, 20), 50))
offset greatest(0, coalesce(offset_val, 0));
$$;
