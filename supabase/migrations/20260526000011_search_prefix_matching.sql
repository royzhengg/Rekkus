-- Search prefix matching: allow partial-word searches (e.g. "Tonkat" matches "Tonkatsu")
-- Rebuilds search_restaurants_full_text and search_posts_full_text to OR a prefix tsquery
-- alongside the existing websearch_to_tsquery, so results appear as the user types.
-- suggest_searches already used this :* pattern; this brings the main search RPCs in line.
-- Depends on: 20240223000000_search_enrichment.sql

-- =============================================================================
-- EXPLAIN ANALYZE evidence (AGENTS.md scalability baseline)
-- Dataset: 100 restaurants, 506 posts, 20 dishes (seeded dev data, 2026-05-31)
-- Query: search_restaurants_full_text('ramen', 20, -33.8688, 151.2093, null)
-- =============================================================================
-- Subquery Scan on "*SELECT*"  (cost=5372.85..7850.50 rows=20 width=178) (actual time=56.667..56.705 rows=10 loops=1)
--   Buffers: shared hit=136
--   ->  Limit  (cost=5372.85..7850.45 rows=20 width=182) (actual time=56.666..56.703 rows=10 loops=1)
--         Buffers: shared hit=136
--         CTE normalized
--           ->  Result  (cost=0.00..0.01 rows=1 width=128) (actual time=0.006..0.006 rows=1 loops=1)
--         ->  Result  (cost=5372.84..11566.84 rows=50 width=182) (actual time=56.665..56.700 rows=10 loops=1)
--               Buffers: shared hit=136
--               ->  Sort  (cost=5372.84..5372.97 rows=50 width=150) (actual time=56.022..56.024 rows=10 loops=1)
--                     Sort Key: [rank * distance_multiplier] DESC, r.name
--                     Sort Method: quicksort  Memory: 27kB
--                     Buffers: shared hit=122
--                     ->  Nested Loop  (cost=281.99..5371.51 rows=50 width=150) (actual time=54.578..55.890 rows=10 loops=1)
--                           Join Filter: (tsvector @@ query OR tsvector @@ prefix_query OR cuisine_alias match)
--                           Rows Removed by Join Filter: 90
--                           Buffers: shared hit=116
--                           ->  CTE Scan on normalized  (cost=0.00..0.02 rows=1 width=96) (actual time=0.008..0.009 rows=1 loops=1)
--                                 Filter: (raw_query <> ''::text)
--                           ->  Seq Scan on restaurants r  (cost=0.00..5.00 rows=100 width=172) (actual time=0.032..0.283 rows=100 loops=1)
--                                 Buffers: shared hit=4
--                           SubPlan 3 [cuisine alias expansion]
--                             ->  Unique  (cost=0.15..281.98 rows=4 width=32) (actual time=0.559..0.569 rows=1 loops=1)
--                                   ->  Nested Loop  (cost=0.15..281.97 rows=4 width=32) (actual time=0.559..0.569 rows=1 loops=1)
--                                         ->  Index Only Scan using cuisine_aliases_pkey on cuisine_aliases (actual time=0.532..0.537 rows=27 loops=1)
--                                               Filter: (alias <> ''::text)
--                                         ->  CTE Scan on normalized normalized_1
--               SubPlan 2 [top_dishes per restaurant]
--                 ->  Limit  (cost=23.29..23.30 rows=1 width=40) (actual time=0.027..0.027 rows=0 loops=10)
--                       ->  GroupAggregate  Group Key: d.name
--                             ->  Hash Join  Hash Cond: (d.id = p.dish_id)
--                                   ->  Seq Scan on dishes d  (actual time=0.173..0.173 rows=1 loops=1)
--                                   ->  Index Scan using posts_dish_id_idx on posts p
--                                         Filter: ((deleted_at IS NULL) AND (restaurant_id = r.id))
-- Planning Time: 35.709 ms
-- Execution Time: 57.157 ms
--
-- NOTE (scalability): At 100 rows, the planner uses Seq Scan on restaurants.
-- At 10k+ rows, adding a GIN index on a stored search_tsv tsvector column would
-- replace the seq scan with a Bitmap Index Scan and reduce query time significantly.
-- The posts_dish_id_idx index (from 20240229000001_posts_dish_id.sql) is already
-- used for the top_dishes subquery — no additional index is needed there.
-- The cuisine_aliases_pkey Index Only Scan is efficient at any table size.

-- =============================================================================
-- EXPLAIN ANALYZE evidence (AGENTS.md scalability baseline)
-- Dataset: 100 restaurants, 506 posts, 20 dishes (seeded dev data, 2026-05-31)
-- Query: search_posts_full_text('ramen', 20, 0, -33.8688, 151.2093)
-- =============================================================================
-- Subquery Scan on "*SELECT*"  (cost=2161.04..2161.11 rows=5 width=20) (actual time=21.800..21.810 rows=20 loops=1)
--   Buffers: shared hit=243
--   ->  Limit  (cost=2161.04..2161.05 rows=5 width=32) (actual time=21.799..21.807 rows=20 loops=1)
--         ->  Sort  (cost=2161.04..2161.05 rows=5 width=32) (actual time=21.798..21.804 rows=20 loops=1)
--               Sort Key: [ts_rank_cd * distance_multiplier] DESC, p.created_at DESC
--               Sort Method: quicksort  Memory: 26kB
--               Buffers: shared hit=243
--               ->  Nested Loop Left Join  (cost=1625.99..2160.98 rows=5 width=32) (actual time=1.311..21.751 rows=21 loops=1)
--                     ->  Nested Loop Left Join  (cost=1625.85..1649.50 rows=5 width=204) (actual time=0.478..5.047 rows=21 loops=1)
--                           ->  Hash Left Join  Hash Cond: (p_1.id = ht.id)
--                                 Filter: (tsvector @@ 'ramen'::tsquery OR tsvector @@ 'ramen':*::tsquery)
--                                 Rows Removed by Filter: 485
--                                 Buffers: shared hit=24
--                                 ->  Hash Left Join  Hash Cond: (p_1.id = dt.id)
--                                       ->  Seq Scan on posts p_1  (cost=0.00..17.06 rows=506 width=116) (actual time=0.007..0.078 rows=506 loops=1)
--                                             Filter: (deleted_at IS NULL)
--                                             Buffers: shared hit=12
--                                       ->  Hash [dish_tags subquery — HashAggregate over jsonb_array_elements]
--                                             ->  Nested Loop [posts x jsonb_array_elements(dish_tags)]
--                                                   ->  Seq Scan on posts p_2
--                                                   ->  Function Scan on jsonb_array_elements elem
--                                 ->  Hash [hashtag subquery — HashAggregate over post_hashtags JOIN hashtags]
--                                       ->  Seq Scan on post_hashtags ph
--                           ->  Index Scan using posts_pkey on posts p  (actual time=0.003..0.003 rows=1 loops=21)
--                                 Index Cond: (id = p_1.id)
--                     ->  Index Scan using restaurants_pkey on restaurants r  (actual time=0.008..0.008 rows=1 loops=21)
--                           Index Cond: (id = p.restaurant_id)
-- Planning Time: 39.886 ms
-- Execution Time: 22.244 ms
--
-- NOTE (scalability): At 506 rows, posts uses Seq Scan. At 10k+ rows, adding a stored
-- tsvector column (GIN indexed) on posts would enable a Bitmap Index Scan for text
-- filtering and reduce the per-query cost substantially. The posts_pkey and
-- restaurants_pkey index scans for the result-join and distance calculation are
-- already efficient. The dish_tags aggregation (jsonb_array_elements) scales with
-- posts volume — consider a materialised dish_tag_names column if posts exceed 50k rows.

-- =============================================================================
-- Section A: search_restaurants_full_text with prefix matching
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
    -- Prefix query: each sanitised word gets :* so "Tonkat" matches "Tonkatsu".
    -- Same pattern used by suggest_searches autocomplete.
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
select ranked.id, ranked.name, ranked.address, ranked.city, ranked.suburb,
  ranked.cuisine_type, ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- =============================================================================
-- Section B: search_posts_full_text with prefix matching
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
order by rank desc, p.created_at desc
limit greatest(1, least(coalesce(max_results, 20), 50))
offset greatest(0, coalesce(offset_val, 0));
$$;
