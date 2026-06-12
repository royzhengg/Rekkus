-- B-574: Search Freshness V1
--
-- Adds freshness timestamps to existing search RPC result shapes so the client
-- can apply bounded cold-start exposure without adding a materialized index.
--
-- EXPLAIN ANALYZE evidence (AGENTS.md scalability baseline)
-- Dataset: current local/staging search seed volume from B-563/B-573.
-- Query: search_restaurants_full_text('ramen', 20, null, null, null)
-- Result: same indexed FTS path as 20260601000008; added timestamp subqueries
-- use existing posts_restaurant_id_idx / posts_dish_id_idx access patterns and
-- are capped by the outer max_results limit.

drop function if exists public.search_dishes_full_text(text, double precision, double precision, integer);

create function public.search_dishes_full_text(
  query text,
  near_lat double precision default null,
  near_lng double precision default null,
  max_results integer default 10
)
returns table (
  id uuid,
  name text,
  cuisine_type text,
  top_photo_url text,
  save_count bigint,
  post_count bigint,
  first_posted_at timestamptz,
  latest_posted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.name,
    d.cuisine_type,
    (
      select coalesce(pp.processed_url, pp.thumbnail_url)
      from posts p
      join post_photos pp on pp.post_id = p.id and pp.deleted_at is null
      where p.dish_id = d.id
        and p.deleted_at is null
        and pp.media_type = 'image'
      order by p.created_at desc
      limit 1
    ) as top_photo_url,
    (
      select count(*)
      from saved_dishes sd
      where sd.dish_id = d.id
    ) as save_count,
    (
      select count(*)
      from posts p
      where p.dish_id = d.id
        and p.deleted_at is null
    ) as post_count,
    (
      select min(p.created_at)
      from posts p
      where p.dish_id = d.id
        and p.deleted_at is null
    ) as first_posted_at,
    (
      select max(p.created_at)
      from posts p
      where p.dish_id = d.id
        and p.deleted_at is null
    ) as latest_posted_at
  from dishes d
  where
    d.search_tsv @@ websearch_to_tsquery('english', search_dishes_full_text.query)
    or extensions.similarity(d.name_normalized, lower(search_dishes_full_text.query)) > 0.3
  order by
    ts_rank(d.search_tsv, websearch_to_tsquery('english', search_dishes_full_text.query)) desc,
    save_count desc
  limit search_dishes_full_text.max_results
$$;

grant execute on function public.search_dishes_full_text(text, double precision, double precision, integer)
  to authenticated, anon;

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
  open_now boolean, rank real, top_dishes text[],
  post_count bigint,
  created_at timestamptz, first_posted_at timestamptz, latest_posted_at timestamptz
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
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 500   then 2.0
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 1000  then 1.5
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 2000  then 1.25
      when extensions.ST_Distance(r.restaurant_geog, normalized.ref_point) < 5000  then 1.1
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
  ) as top_dishes,
  (
    select count(*)
    from public.posts p
    where p.restaurant_id = ranked.id
      and p.deleted_at is null
  ) as post_count,
  ranked.created_at,
  (
    select min(p.created_at)
    from public.posts p
    where p.restaurant_id = ranked.id
      and p.deleted_at is null
  ) as first_posted_at,
  (
    select max(p.created_at)
    from public.posts p
    where p.restaurant_id = ranked.id
      and p.deleted_at is null
  ) as latest_posted_at
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

grant execute on function public.search_restaurants_full_text(text, integer, double precision, double precision, text)
  to authenticated, anon;
