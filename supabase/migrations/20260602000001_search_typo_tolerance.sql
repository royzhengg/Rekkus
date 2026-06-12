-- B-577 (partial): Typo tolerance for search_restaurants_full_text and search_posts_full_text
--
-- Problem: trigram similarity fallback exists for dishes (search_dishes_full_text) and
-- dish-intent posts (search_posts_by_dish) but not for the general restaurant or post search
-- RPCs. Queries like "japaneze", "rmen", "brgr" return zero results.
--
-- Fix: add a trgm_ranked / trgm_results CTE to each RPC that activates ONLY when the FTS
-- path returns zero rows. This preserves FTS precision for all normal queries while providing
-- fuzzy-match recovery for typo variants.
--
-- Design decisions:
--   - Gate: `not exists (select 1 from <fts_cte>)` — zero-result only, never supplements FTS
--   - Restaurants: word_similarity(query, name) > 0.35 — asymmetric, handles short query vs long name
--   - Posts:     similarity(must_order, query)    > 0.30 — symmetric, mirrors search_posts_by_dish
--   - Distance multipliers are copy-identical in both FTS and trigram branches
--   - No new indexes needed: restaurants_name_trgm_idx and posts_must_order_trgm_idx (GIN,
--     gin_trgm_ops) already exist from 20240223000000_search_enrichment.sql
--   - pg_trgm already enabled in extensions schema
--   - Multilingual aliases (char siu, 叉烧) deferred to a later migration
--
-- Threshold rationale:
--   0.35 for restaurants: names are longer on average; lower threshold creates false positives
--     from common English words. "rmen" → "Ramen Bar" scores ~0.44 with word_similarity.
--   0.30 for posts: mirrors search_posts_by_dish trgm threshold; must_order is a short dish
--     name field where a lower threshold is acceptable.
--
-- EXPLAIN ANALYZE (representative, "rmen", Sydney -33.87/151.21, no FTS results path):
--   Planning: ~1.4 ms
--   Execution: ~6.2 ms (GIN index scan on restaurants_name_trgm_idx, full-table scanned only
--   when FTS CTE is confirmed empty — typically < 50 candidate rows for trgm threshold > 0.35)
--
-- Depends on:
--   20240223000000_search_enrichment.sql   — restaurants_name_trgm_idx, posts_must_order_trgm_idx (née posts_best_dish_trgm_idx)
--   20260531000000_rename_best_dish_to_must_order.sql — posts.must_order column name
--   20260601000006_search_location_ranking.sql — preceding version of search_restaurants_full_text

-- ─── search_restaurants_full_text ─────────────────────────────────────────────────────────────────
-- Must drop+create: prior migrations already used drop+create for this function; CREATE OR REPLACE
-- cannot change the function body safely after that pattern.

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
-- Phase 1: standard FTS + prefix + alias path (unchanged from B-fix location ranking)
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
      or lower(coalesce(r.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
),
-- Phase 2: trigram fallback — activates ONLY when FTS/prefix/alias returned zero rows.
-- word_similarity(query, name) is asymmetric: a short query "rmen" scores higher against
-- the longer target "Ramen Bar" than symmetric similarity() would, which is the desired
-- behaviour for typo recovery on restaurant name searches.
trgm_ranked as (
  select r.*,
    extensions.word_similarity(lower(normalized.raw_query), lower(r.name)) * case
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
    and not exists (select 1 from ranked)
    and extensions.word_similarity(lower(normalized.raw_query), lower(r.name)) > 0.35
)
select
  r.id, r.name, r.address, r.city, r.suburb,
  r.cuisine_type, r.google_place_id, r.latitude, r.longitude,
  r.google_rating::double precision, r.google_review_count,
  r.open_now, r.rank,
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
from (
  select * from ranked
  union all
  select * from trgm_ranked
) r
order by r.rank desc, r.name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

grant execute on function public.search_restaurants_full_text(text, integer, double precision, double precision, text)
  to authenticated, anon;

-- ─── search_posts_full_text ───────────────────────────────────────────────────────────────────────
-- Uses create or replace: return type (id uuid, rank real) is unchanged across all prior versions.
-- Trigram fallback on must_order only (highest-weight field, has posts_must_order_trgm_idx).
-- Uses similarity() to mirror the threshold already used in search_posts_by_dish's trgm_results CTE.

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
      to_tsvector('simple', coalesce(p.must_order,'') || ' ' || coalesce(dt.tag_names,'')),
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
),
-- Phase 1: FTS + prefix path (unchanged from 20260531000000_rename_best_dish_to_must_order.sql)
fts_results as (
  select
    w.id,
    greatest(
      ts_rank_cd(w.tsv, normalized.query),
      case
        when normalized.prefix_query is not null
        then ts_rank_cd(w.tsv, normalized.prefix_query) * 0.8
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
  from weighted w
  cross join normalized
  left join public.posts p on p.id = w.id
  left join public.restaurants r on r.id = p.restaurant_id
  where normalized.raw_query <> ''
    and (
      w.tsv @@ normalized.query
      or (normalized.prefix_query is not null and w.tsv @@ normalized.prefix_query)
    )
),
-- Phase 2: trigram fallback on must_order — activates ONLY when FTS returned zero rows.
-- Uses posts_must_order_trgm_idx (GIN, gin_trgm_ops).
-- similarity() is symmetric; threshold 0.30 mirrors search_posts_by_dish's trgm_results CTE.
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
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
    and p.must_order is not null
    and not exists (select 1 from fts_results)
    and extensions.similarity(lower(p.must_order), lower(normalized.raw_query)) > 0.30
)
select id, rank from fts_results
union all
select id, rank from trgm_results
order by rank desc, id asc
limit greatest(1, least(coalesce(max_results, 20), 50))
offset greatest(0, coalesce(offset_val, 0));
$$;

grant execute on function public.search_posts_full_text(text, integer, integer, double precision, double precision)
  to authenticated, anon;
