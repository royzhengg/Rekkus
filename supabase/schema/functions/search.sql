-- Domain: Functions / Search
-- Owner: Search / Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- expand_search_cuisines
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
  LEFT JOIN public.places pl ON pl.id = p.place_id
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
      OR lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(h.name, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(p.caption, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(p.must_order, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(h.name, '')) LIKE '%' || t.term || '%'
      )
    )
),
place_matches AS (
  SELECT DISTINCT pl.id, lower(pl.cuisine_type) AS cuisine_type
  FROM public.places pl
  CROSS JOIN normalized n
  WHERE pl.cuisine_type IS NOT NULL
    AND trim(pl.cuisine_type) <> ''
    AND n.q <> ''
    AND (
      lower(coalesce(pl.name, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.city, '')) LIKE '%' || n.q || '%'
      OR lower(coalesce(pl.address, '')) LIKE '%' || n.q || '%'
      OR EXISTS (
        SELECT 1
        FROM terms t
        WHERE lower(coalesce(pl.name, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.cuisine_type, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.city, '')) LIKE '%' || t.term || '%'
          OR lower(coalesce(pl.address, '')) LIKE '%' || t.term || '%'
      )
    )
),
signals AS (
  SELECT cuisine_type, 2 AS weight FROM post_matches
  UNION ALL
  SELECT cuisine_type, 1 AS weight FROM place_matches
)
SELECT
  initcap(cuisine_type) AS cuisine_type,
  sum(weight)::integer AS match_count
FROM signals
GROUP BY cuisine_type
ORDER BY match_count DESC, cuisine_type ASC
LIMIT greatest(1, least(coalesce(max_cuisines, 3), 10));
$$;

-- search_dishes_full_text
create or replace function public.search_dishes_full_text(
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
  post_count bigint
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
    ) as post_count
  from dishes d
  where
    d.search_tsv @@ websearch_to_tsquery('english', search_dishes_full_text.query)
    or extensions.similarity(d.name_normalized, lower(search_dishes_full_text.query)) > 0.3
  order by
    ts_rank(d.search_tsv, websearch_to_tsquery('english', search_dishes_full_text.query)) desc,
    save_count desc
  limit search_dishes_full_text.max_results
$$;

-- search_posts_by_dish
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
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank,
    'fts'::text as match_source
  from public.posts p
  cross join normalized
  left join dish_tag_text dt on dt.id = p.id
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and p.deleted_at is null
    and p.search_tsv @@ normalized.query
),
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      else 1.0
    end as rank,
    'trgm'::text as match_source
  from public.posts p
  cross join normalized
  left join public.places pl on pl.id = p.place_id
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

-- search_posts_full_text
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
hashtag_text as (
  select ph.post_id as id, string_agg(h.name, ' ') as ht_names
  from public.post_hashtags ph
  join public.hashtags h on h.id = ph.hashtag_id
  group by ph.post_id
),
weighted as (
  -- Start from the stored search_tsv (GIN-indexed) and add hashtag enrichment.
  -- Hashtag names live in a joined table so can't be in the generated column;
  -- we add them here at weight B for ranking after the index-filtered set.
  select p.id,
    p.search_tsv ||
    setweight(to_tsvector('simple', coalesce(ht.ht_names,'')), 'B') as tsv,
    p.search_tsv
  from public.posts p
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
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from weighted w
  cross join normalized
  left join public.posts p on p.id = w.id
  left join public.places pl on pl.id = p.place_id
  where normalized.raw_query <> ''
    and (
      w.search_tsv @@ normalized.query
      or (normalized.prefix_query is not null and w.search_tsv @@ normalized.prefix_query)
    )
),
-- Phase 2: trigram fallback on must_order — activates ONLY when FTS returned zero rows.
-- Uses posts_must_order_trgm_idx (GIN, gin_trgm_ops).
-- similarity() is symmetric; threshold 0.30 mirrors search_posts_by_dish's trgm_results CTE.
trgm_results as (
  select
    p.id,
    extensions.similarity(lower(coalesce(p.must_order,'')), lower(normalized.raw_query)) * case
      when normalized.ref_point is null or pl.place_geog is null then 1.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(pl.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from public.posts p
  cross join normalized
  left join public.places pl on pl.id = p.place_id
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

-- search_places_full_text
create or replace function public.search_places_full_text(
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
  open_now boolean, occasion_tags text[], rank real
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
  select p.*,
    greatest(
      ts_rank(
        to_tsvector('simple',
          coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
          coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
        ),
        normalized.query
      ),
      case
        when normalized.prefix_query is not null
        then ts_rank(
          to_tsvector('simple',
            coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
            coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
          ),
          normalized.prefix_query
        ) * 0.8
        else 0.0
      end
    ) * case
      when normalized.ref_point is null or p.place_geog is null then 1.0
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 500  then 2.0
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 1000 then 1.5
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 2000 then 1.25
      when extensions.ST_Distance(p.place_geog, normalized.ref_point) < 5000 then 1.1
      else 1.0
    end as rank
  from public.places p cross join normalized
  where normalized.raw_query <> ''
    and (suburb_filter is null or lower(p.suburb) = lower(suburb_filter))
    and (
      to_tsvector('simple',
        coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
        coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
      ) @@ normalized.query
      or (
        normalized.prefix_query is not null
        and to_tsvector('simple',
          coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
          coalesce(p.suburb,'') || ' ' || coalesce(p.city,'') || ' ' || coalesce(p.address,'')
        ) @@ normalized.prefix_query
      )
      or lower(coalesce(p.cuisine_type,'')) in (select cuisine_type from alias_matches)
    )
)
select ranked.id, ranked.name, ranked.address, ranked.city, ranked.suburb,
  ranked.cuisine_type, ranked.google_place_id, ranked.latitude, ranked.longitude,
  ranked.google_rating::double precision, ranked.google_review_count,
  ranked.open_now, ranked.occasion_tags, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- suggest_searches
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
place_matches as (
  select
    'place'::text as suggestion_type,
    p.name as display_text,
    coalesce(p.cuisine_type, p.city, '') as secondary_text,
    p.id as entity_id,
    ts_rank(
      to_tsvector('simple',
        coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
        coalesce(p.suburb,'') || ' ' || coalesce(p.city,'')
      ),
      to_tsquery('simple', replace(trim(prefix.raw),' ',' & ') || ':*')
    ) * case
      when prefix.ref_point is null or p.place_geog is null then 1.0
      when extensions.ST_Distance(p.place_geog, prefix.ref_point) < 1000 then 2.0
      when extensions.ST_Distance(p.place_geog, prefix.ref_point) < 5000 then 1.5
      else 1.0
    end as score
  from public.places p, prefix
  where prefix.raw <> ''
    and to_tsvector('simple',
      coalesce(p.name,'') || ' ' || coalesce(p.cuisine_type,'') || ' ' ||
      coalesce(p.suburb,'') || ' ' || coalesce(p.city,'')
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
select * from place_matches
union all
select * from dish_matches
union all
select * from hashtag_matches
order by score desc;
$$;

-- match_embeddings
create or replace function public.match_embeddings(
  query_embedding extensions.vector(384),
  match_type text,
  match_count integer default 10,
  similarity_threshold real default 0.65
)
returns table (id uuid, similarity real)
language plpgsql stable as $$
begin
  if match_type = 'post' then
    return query
      select p.id, (1 - (pe.embedding <=> query_embedding))::real as similarity
      from public.posts p
      join public.post_embeddings pe on pe.post_id = p.id
      where p.deleted_at is null
        and (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  elsif match_type = 'place' then
    return query
      select p.id, (1 - (p.embedding <=> query_embedding))::real as similarity
      from public.places p
      where p.embedding is not null
        and (1 - (p.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  end if;
end;
$$;

-- resolve_suburb_query
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

  select distinct p.suburb::text,
    extensions.similarity(lower(p.suburb), lower(trim(input_text)))::real,
    null::double precision, null::double precision
  from public.places p
  where p.suburb is not null
    and extensions.similarity(lower(p.suburb), lower(trim(input_text))) > 0.45

  order by 2 desc
  limit 5;
$$;

-- places_in_bounding_box
create or replace function public.places_in_bounding_box(
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
  p.id,
  p.name,
  p.address,
  p.city,
  p.cuisine_type,
  p.google_place_id,
  p.latitude,
  p.longitude,
  p.google_rating::double precision,
  p.google_review_count,
  p.open_now
from public.places p
where p.latitude between least(min_lat, max_lat) and greatest(min_lat, max_lat)
  and p.longitude between least(min_lng, max_lng) and greatest(min_lng, max_lng)
  and (
    p.place_geog is null
    or extensions.ST_Intersects(
      p.place_geog::extensions.geometry,
      extensions.ST_MakeEnvelope(
        least(min_lng, max_lng),
        least(min_lat, max_lat),
        greatest(min_lng, max_lng),
        greatest(min_lat, max_lat),
        4326
      )
    )
  )
order by p.name asc
limit greatest(1, least(coalesce(max_results, 50), 100));
$$;

-- places_within_radius — true circle search using PostGIS ST_DWithin
-- Replaces bounding-box queries for nearby place fetching.
-- distance_km is returned as the true great-circle distance.
create or replace function public.places_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_metres double precision default 2000,
  p_max_results integer default 8
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
  distance_km double precision
)
language sql
stable
as $$
select
  p.id,
  p.name,
  p.address,
  p.city,
  p.cuisine_type,
  p.google_place_id,
  p.latitude,
  p.longitude,
  p.google_rating::double precision,
  p.google_review_count,
  p.open_now,
  (extensions.ST_Distance(
    p.place_geog,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
  ) / 1000.0) as distance_km
from public.places p
where p.place_geog is not null
  and extensions.ST_DWithin(
    p.place_geog,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    p_radius_metres
  )
order by distance_km asc
limit greatest(1, least(coalesce(p_max_results, 8), 50));
$$;

-- get_personalized_suggestions
create or replace function public.get_personalized_suggestions(
  p_user_id uuid,
  p_failed_query text,
  p_limit integer default 3
)
returns table (
  query text,
  score numeric,
  source text
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      p_user_id as user_id,
      lower(trim(regexp_replace(coalesce(p_failed_query, ''), '\s+', ' ', 'g'))) as failed_query,
      greatest(1, least(coalesce(p_limit, 3), 10)) as result_limit
  ),
  search_history as (
    select
      lower(trim(metadata->>'query')) as query,
      count(*)::numeric * 1.0 as score,
      'search_history'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type = 'search_query'
      and created_at >= now() - interval '90 days'
      and metadata ? 'query'
    group by lower(trim(metadata->>'query'))
  ),
  engagement_cuisines as (
    select
      lower(trim(metadata->>'cuisine_type')) as query,
      sum(case event_type when 'post_save' then 3 when 'place_save' then 3 else 1 end)::numeric as score,
      'engagement_cuisine'::text as source
    from public.analytics_events, params
    where auth.uid() = params.user_id
      and analytics_events.user_id = params.user_id
      and event_type in ('post_view', 'post_save', 'place_view', 'place_save')
      and created_at >= now() - interval '90 days'
      and metadata ? 'cuisine_type'
    group by lower(trim(metadata->>'cuisine_type'))
  ),
  saved_post_cuisines as (
    select
      lower(trim(p.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_post'::text as source
    from public.saves s
    join public.posts p on p.id = s.post_id
    join params on true
    where auth.uid() = params.user_id
      and s.user_id = params.user_id
      and p.cuisine_type is not null
    group by lower(trim(p.cuisine_type))
  ),
  saved_place_cuisines as (
    select
      lower(trim(pl.cuisine_type)) as query,
      count(*)::numeric * 3.0 as score,
      'saved_place'::text as source
    from public.saved_places sl
    join public.places pl on pl.id = sl.place_id
    join params on true
    where auth.uid() = params.user_id
      and sl.user_id = params.user_id
      and pl.cuisine_type is not null
    group by lower(trim(pl.cuisine_type))
  ),
  saved_dish_cuisines as (
    select
      lower(trim(d.cuisine_type)) as query,
      count(*)::numeric * 4.0 as score,
      'saved_dish'::text as source
    from public.saved_dishes sd
    join public.dishes d on d.id = sd.dish_id
    join params on true
    where auth.uid() = params.user_id
      and sd.user_id = params.user_id
      and d.cuisine_type is not null
    group by lower(trim(d.cuisine_type))
  ),
  topic_follows as (
    select
      lower(trim(topic)) as query,
      count(*)::numeric * 2.0 as score,
      'topic_follow'::text as source
    from public.user_topic_follows utf
    join params on true
    where auth.uid() = params.user_id
      and utf.user_id = params.user_id
    group by lower(trim(topic))
  ),
  user_cuisine_terms as (
    select query from engagement_cuisines
    union
    select query from saved_post_cuisines
    union
    select query from saved_place_cuisines
    union
    select query from saved_dish_cuisines
    union
    select query from topic_follows
  ),
  taste_adjacent_trending as (
    select
      lower(trim(ts.query)) as query,
      max(ts.score)::numeric * 0.25 as score,
      'taste_trending'::text as source
    from public.trending_searches ts
    join user_cuisine_terms uct
      on lower(ts.query) like '%' || uct.query || '%'
      or uct.query like '%' || lower(ts.query) || '%'
    where ts.near_city = 'global'
      and ts.user_count >= 2
      and ts.updated_at >= now() - interval '7 days'
    group by lower(trim(ts.query))
  ),
  global_trending as (
    select
      lower(trim(query)) as query,
      max(score)::numeric * 0.05 as score,
      'global_trending'::text as source
    from public.trending_searches
    where near_city = 'global'
      and user_count >= 2
      and updated_at >= now() - interval '7 days'
    group by lower(trim(query))
  ),
  candidates as (
    select * from search_history
    union all select * from engagement_cuisines
    union all select * from saved_post_cuisines
    union all select * from saved_place_cuisines
    union all select * from saved_dish_cuisines
    union all select * from topic_follows
    union all select * from taste_adjacent_trending
    union all select * from global_trending
  ),
  filtered as (
    select
      trim(regexp_replace(query, '\s+', ' ', 'g')) as normalized_query,
      score,
      source
    from candidates, params
    where query is not null
      and length(trim(query)) > 1
      and lower(trim(regexp_replace(query, '\s+', ' ', 'g'))) <> params.failed_query
  ),
  aggregated as (
    select
      normalized_query as query,
      sum(score) as score
    from filtered
    group by normalized_query
  ),
  best_source as (
    select distinct on (normalized_query)
      normalized_query,
      source
    from filtered
    order by normalized_query, score desc, source asc
  )
  select
    aggregated.query,
    aggregated.score,
    best_source.source
  from aggregated
  join best_source on best_source.normalized_query = aggregated.query
  order by aggregated.score desc, aggregated.query asc
  limit (select result_limit from params);
$$;

-- get_recent_search_history
create or replace function public.get_recent_search_history(
  max_results integer default 10,
  lookback_days integer default 30
)
returns table (
  query text,
  last_searched_at timestamptz,
  search_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select
      trim(metadata->>'query') as query,
      created_at
    from public.analytics_events
    where auth.uid() is not null
      and user_id = auth.uid()
      and event_type = 'search_query'
      and created_at >= now() - make_interval(days => greatest(1, least(coalesce(lookback_days, 30), 365)))
      and metadata ? 'query'
  )
  select
    query,
    max(created_at) as last_searched_at,
    count(*)::integer as search_count
  from normalized
  where query is not null
    and length(query) > 1
  group by lower(query), query
  order by last_searched_at desc, search_count desc
  limit greatest(1, least(coalesce(max_results, 10), 50));
$$;

-- get_search_quality_metrics
create or replace function public.get_search_quality_metrics(
  lookback_days integer default 30
)
returns table (
  day date,
  result_type text,
  result_position integer,
  search_sessions integer,
  query_count integer,
  click_count integer,
  attributed_view_count integer,
  attributed_save_count integer,
  attributed_review_count integer,
  zero_result_count integer,
  reformulation_count integer,
  success_count integer,
  success_rate numeric,
  ctr numeric,
  zero_result_rate numeric,
  reformulation_rate numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(lookback_days, 30), 90))::integer as days
  ),
  events as (
    select
      ae.created_at,
      ae.event_type,
      ae.metadata,
      ae.metadata->>'search_session_id' as search_session_id,
      ae.metadata->>'result_type' as result_type,
      case
        when (ae.metadata->>'result_position') ~ '^[0-9]+$'
          then (ae.metadata->>'result_position')::integer
        else null::integer
      end as result_position
    from public.analytics_events ae, params
    where ae.created_at >= now() - make_interval(days => params.days)
      and ae.event_type in (
        'search_query',
        'search_result_click',
        'search_session_end',
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  day_keys as (
    select distinct date_trunc('day', created_at)::date as day
    from events
  ),
  dimensions as (
    select day, null::text as result_type, null::integer as result_position
    from day_keys
    union
    select
      date_trunc('day', created_at)::date as day,
      result_type,
      result_position
    from events
    where event_type = 'search_result_click'
      and result_type is not null
      and result_position is not null
  ),
  session_ends as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      coalesce((metadata->>'had_results')::boolean, false) as had_results,
      coalesce((metadata->>'result_clicked')::boolean, false) as result_clicked
    from events
    where event_type = 'search_session_end'
      and search_session_id is not null
  ),
  attributed_events as (
    select
      date_trunc('day', created_at)::date as day,
      search_session_id,
      result_type,
      result_position,
      event_type
    from events
    where search_session_id is not null
      and event_type in (
        'post_view',
        'post_save',
        'place_view',
        'place_save',
        'dish_view',
        'dish_save',
        'post_published'
      )
  ),
  daily_queries as (
    select
      d.day,
      count(*) filter (where e.event_type = 'search_query')::integer as query_count,
      count(*) filter (
        where e.event_type = 'search_query'
          and e.metadata->>'previous_query' is not null
          and lower(trim(e.metadata->>'previous_query')) <> lower(trim(coalesce(e.metadata->>'query', '')))
      )::integer as reformulation_count
    from day_keys d
    left join events e on date_trunc('day', e.created_at)::date = d.day
    group by d.day
  ),
  daily_sessions as (
    select
      d.day,
      count(distinct se.search_session_id)::integer as search_sessions,
      count(distinct se.search_session_id) filter (where not se.had_results)::integer as zero_result_count,
      count(distinct se.search_session_id) filter (
        where se.result_clicked
          or exists (
            select 1
            from attributed_events attr
            where attr.search_session_id = se.search_session_id
          )
      )::integer as success_count
    from day_keys d
    left join session_ends se on se.day = d.day
    group by d.day
  ),
  daily as (
    select
      q.day,
      q.query_count,
      s.search_sessions,
      s.zero_result_count,
      q.reformulation_count,
      s.success_count
    from daily_queries q
    join daily_sessions s on s.day = q.day
  ),
  dimension_counts as (
    select
      dim.day,
      dim.result_type,
      dim.result_position,
      count(*) filter (
        where e.event_type = 'search_result_click'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as click_count,
      count(*) filter (
        where e.event_type in ('post_view', 'place_view', 'dish_view')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_view_count,
      count(*) filter (
        where e.event_type in ('post_save', 'place_save', 'dish_save')
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_save_count,
      count(*) filter (
        where e.event_type = 'post_published'
          and (
            dim.result_type is null
            or (e.result_type = dim.result_type and e.result_position = dim.result_position)
          )
      )::integer as attributed_review_count
    from dimensions dim
    left join events e on date_trunc('day', e.created_at)::date = dim.day
    group by dim.day, dim.result_type, dim.result_position
  )
  select
    d.day,
    dc.result_type,
    dc.result_position,
    d.search_sessions,
    d.query_count,
    dc.click_count,
    dc.attributed_view_count,
    dc.attributed_save_count,
    dc.attributed_review_count,
    d.zero_result_count,
    d.reformulation_count,
    d.success_count,
    round(d.success_count * 100.0 / nullif(d.search_sessions, 0), 2) as success_rate,
    round(dc.click_count * 100.0 / nullif(d.query_count, 0), 2) as ctr,
    round(d.zero_result_count * 100.0 / nullif(d.search_sessions, 0), 2) as zero_result_rate,
    round(d.reformulation_count * 100.0 / nullif(d.query_count, 0), 2) as reformulation_rate
  from daily d
  join dimension_counts dc on dc.day = d.day
  order by d.day desc, dc.result_type nulls first, dc.result_position nulls first;
$$;

-- refresh_trending_queries
create or replace function public.refresh_trending_queries()
returns void language sql security definer set search_path = public as $$
  with recent_searches as (
    select
      trim(metadata->>'query') as query,
      coalesce(nullif(trim(metadata->>'near_city'), ''), 'global') as near_city,
      user_id,
      created_at
    from public.analytics_events
    where event_type = 'search_query'
      and created_at >= now() - interval '24 hours'
      and metadata->>'query' is not null
      and length(trim(metadata->>'query')) >= 2
  ),
  partitioned as (
    select query, 'global'::text as near_city, user_id, created_at
    from recent_searches
    union all
    select query, near_city, user_id, created_at
    from recent_searches
    where lower(near_city) <> 'global'
  )
  insert into public.trending_searches (query, near_city, search_count, user_count, score, updated_at)
  select
    query,
    near_city,
    count(*)::integer as search_count,
    count(distinct user_id)::integer as user_count,
    sum(case when created_at >= now() - interval '6 hours' then 2.0 else 1.0 end)::real as score,
    now()
  from partitioned
  group by query, near_city
  on conflict (query, near_city) do update set
    search_count = excluded.search_count,
    user_count   = excluded.user_count,
    score        = excluded.score,
    updated_at   = now();
$$;
