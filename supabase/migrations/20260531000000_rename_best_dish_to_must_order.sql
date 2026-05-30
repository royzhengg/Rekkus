-- B-407: rename best_dish → must_order on posts and post_drafts
-- Aligns the data model with the "Must order" UI copy that has been live in production.
-- All stored functions that referenced best_dish in their SQL body are recreated here.
-- Functional indexes reference columns by OID/attnum and survive the rename intact;
-- the trigram index is renamed for clarity only.

-- 1. Rename columns ----------------------------------------------------------------
ALTER TABLE public.posts RENAME COLUMN best_dish TO must_order;
ALTER TABLE public.post_drafts RENAME COLUMN best_dish TO must_order;

-- 2. Rename trigram index for clarity ---------------------------------------------
ALTER INDEX IF EXISTS posts_best_dish_trgm_idx RENAME TO posts_must_order_trgm_idx;

-- 3. Recreate stored functions that referenced best_dish --------------------------

-- 3a. expand_search_cuisines (source: 20240202000000_search_query_expansion.sql)
CREATE OR REPLACE FUNCTION public.expand_search_cuisines(
  query_text text,
  max_cuisines integer DEFAULT 3
)
RETURNS TABLE (
  cuisine_type text,
  match_count integer
)
LANGUAGE sql
STABLE
AS $$
WITH normalized AS (
  SELECT lower(trim(regexp_replace(coalesce(query_text, ''), '[^[:alnum:][:space:]-]', ' ', 'g'))) AS q
),
terms AS (
  SELECT DISTINCT term
  FROM normalized,
  LATERAL regexp_split_to_table(q, '[[:space:]]+') AS term
  WHERE length(term) >= 2
    AND term NOT IN (
      'food', 'restaurant', 'restaurants', 'place', 'places', 'spot', 'spots',
      'the', 'a', 'an', 'in', 'at', 'for', 'and', 'or', 'near', 'with',
      'best', 'good', 'great', 'nice'
    )
),
post_matches AS (
  SELECT DISTINCT p.id, lower(p.cuisine_type) AS cuisine_type
  FROM public.posts p
  LEFT JOIN public.restaurants r ON r.id = p.restaurant_id
  LEFT JOIN public.post_hashtags ph ON ph.post_id = p.id
  LEFT JOIN public.hashtags h ON h.id = ph.hashtag_id
  CROSS JOIN normalized n
  WHERE p.cuisine_type IS NOT NULL
    AND trim(p.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(p.caption, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.must_order, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(p.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.address, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(h.name, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(p.caption, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(p.must_order, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.address, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(h.name, '')) LIKE '%' || t.term || '%'
      )
    )
),
restaurant_matches AS (
  SELECT DISTINCT r.id, lower(r.cuisine_type) AS cuisine_type
  FROM public.restaurants r
  CROSS JOIN normalized n
  WHERE r.cuisine_type IS NOT NULL
    AND trim(r.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(r.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(r.address, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(r.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(r.address, '')) LIKE '%' || t.term || '%'
      )
    )
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM restaurant_matches
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;

-- 3b. search_posts_full_text (source: 20260526000011_search_prefix_matching.sql)
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

-- 3c. search_posts_by_dish (source: 20240223000000_search_enrichment.sql)
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
      setweight(to_tsvector('simple', coalesce(p.must_order,'') || ' ' || coalesce(dt.tag_names,'')), 'A'),
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
    and setweight(to_tsvector('simple', coalesce(p.must_order,'') || ' ' || coalesce(dt.tag_names,'')), 'A')
        @@ normalized.query
),
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
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
    and p.must_order is not null
    and extensions.similarity(lower(p.must_order), lower(normalized.raw_query)) > 0.25
    and not exists (select 1 from fts_results f where f.id = p.id)
)
select id, rank, match_source from fts_results
union all
select id, rank, match_source from trgm_results
order by rank desc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- 3d. suggest_searches (source: 20240223000000_search_enrichment.sql)
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
    p.must_order as display_text,
    '' as secondary_text,
    null::uuid as entity_id,
    count(*)::real as score
  from public.posts p, prefix
  where prefix.raw <> ''
    and p.must_order is not null
    and p.deleted_at is null
    and to_tsvector('simple', p.must_order)
        @@ to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
  group by p.must_order
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
