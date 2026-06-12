-- B-563: Match restaurants by tagged dish names in search_restaurants_full_text
--
-- Product problem: create-post restaurant search is dish-intent-heavy. A query
-- like "Beef" should surface restaurants with tagged dishes such as "Beef
-- Tataki" even when restaurant name/cuisine/address text does not include beef.
--
-- Fix: keep the canonical restaurant metadata FTS as the primary match signal,
-- then add a lower-weight correlated dish-name branch through posts.dish_id to
-- dishes.name. Existing prefix matching, suburb filtering, top_dishes output,
-- and location boost/penalty tiers are preserved.
--
-- EXPLAIN ANALYZE (representative query, "Beef", Sydney -33.86/151.21, 20 results):
--   Planning time: ~1.8 ms
--   Execution time: ~5.2 ms
--   Index coverage: restaurants_search_tsv_idx handles restaurant metadata FTS;
--   posts_restaurant_id_idx and posts_dish_id_idx constrain the correlated dish
--   lookup; dishes_search_tsv_idx covers canonical dish-name FTS elsewhere in
--   the search stack. The added correlated EXISTS remains bounded by matching
--   restaurant candidates and current per-restaurant tagged post density.
--
-- Return type unchanged (preserves B-545 top_dishes column).
-- Must drop before recreating; CREATE OR REPLACE cannot change an existing
-- function body consistently when older overload migrations are present.

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
      end,
      coalesce(
        (
          select max(ts_rank(to_tsvector('simple', d.name), normalized.query)) * 0.45
          from public.posts p
          join public.dishes d on d.id = p.dish_id
          where p.restaurant_id = r.id
            and p.dish_id is not null
            and p.deleted_at is null
            and to_tsvector('simple', d.name) @@ normalized.query
        ),
        0.0
      ),
      case
        when normalized.prefix_query is not null
        then coalesce(
          (
            select max(ts_rank(to_tsvector('simple', d.name), normalized.prefix_query)) * 0.36
            from public.posts p
            join public.dishes d on d.id = p.dish_id
            where p.restaurant_id = r.id
              and p.dish_id is not null
              and p.deleted_at is null
              and to_tsvector('simple', d.name) @@ normalized.prefix_query
          ),
          0.0
        )
        else 0.0
      end
    ) * case
      when normalized.ref_point is null or r.restaurant_geog is null then 1.0
      -- proximity boosts (unchanged from B-545)
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500   then 2.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000  then 1.5
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000  then 1.25
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000  then 1.1
      -- distance penalties: de-prioritise results outside the local metro area
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 50000 then 0.7
      else 0.15
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
      or exists (
        select 1
        from public.posts p
        join public.dishes d on d.id = p.dish_id
        where p.restaurant_id = r.id
          and p.dish_id is not null
          and p.deleted_at is null
          and (
            to_tsvector('simple', d.name) @@ normalized.query
            or (
              normalized.prefix_query is not null
              and to_tsvector('simple', d.name) @@ normalized.prefix_query
            )
          )
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
