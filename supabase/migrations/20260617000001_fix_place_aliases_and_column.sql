-- Phase 13: Fix stale SQL aliases and critical column-name bug.
--
-- Changes:
--   1. Rename places.restaurant_geog → place_geog
--      (PostgreSQL auto-updates the GiST index definition; no index rebuild needed)
--   2. Fix refresh_place_popularity_cache INSERT: restaurant_id → place_id (was a runtime crash)
--   3. Replace legacy `r` table alias with `p` (or `pl` where `p` = posts) in all non-infra functions
--
-- Infra exception functions (record_restaurant_provider_snapshot, etc.) are NOT touched.

ALTER TABLE public.places RENAME COLUMN restaurant_geog TO place_geog;

-- ---------------------------------------------------------------------------
-- add_saved_target_to_collection
-- ---------------------------------------------------------------------------
create or replace function public.add_saved_target_to_collection(
  p_collection_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id and c.user_id = current_user_id
  ) then
    raise exception 'collection_not_owned';
  end if;

  if p_target_type = 'dish' then
    if not exists (select 1 from public.dishes d where d.id = p_target_id) then
      raise exception 'dish_not_found';
    end if;
    insert into public.saved_dishes (user_id, dish_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, dish_id) do nothing;
  elsif p_target_type = 'post' then
    if not exists (select 1 from public.posts p where p.id = p_target_id and p.deleted_at is null) then
      raise exception 'post_not_found';
    end if;
    insert into public.saves (user_id, post_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, post_id) do nothing;
  elsif p_target_type = 'place' then
    if not exists (select 1 from public.places p where p.id = p_target_id) then
      raise exception 'place_not_found';
    end if;
    insert into public.saved_places (user_id, place_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, place_id) do nothing;
  else
    raise exception 'invalid_target_type';
  end if;

  insert into public.collection_items (collection_id, target_type, target_id)
  values (p_collection_id, p_target_type, p_target_id)
  on conflict (collection_id, target_type, target_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- expand_search_cuisines  (p = posts, pl = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- get_personalized_suggestions  (pl = places within saved_place_cuisines CTE)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- match_embeddings  (p = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- refresh_place_popularity_cache  (p = places; CRITICAL: restaurant_id → place_id)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_place_popularity_cache()
returns void language sql security definer set search_path = public as $$
  insert into public.place_popularity_cache (
    place_id, post_count, interaction_count_30d,
    avg_food_rating, food_rating_count, updated_at
  )
  select
    p.id,
    count(distinct pt.id)::integer,
    count(ae.id) filter (
      where ae.event_type in ('place_click','place_view')
        and ae.created_at >= now() - interval '30 days'
    )::integer,
    avg(pt.food_rating) filter (where pt.food_rating is not null),
    count(pt.id) filter (where pt.food_rating is not null)::integer,
    now()
  from public.places p
  left join public.posts pt on pt.place_id = p.id and pt.deleted_at is null
  left join public.analytics_events ae on ae.entity_id = p.id
  group by p.id
  on conflict (place_id) do update set
    post_count = excluded.post_count,
    interaction_count_30d = excluded.interaction_count_30d,
    avg_food_rating = excluded.avg_food_rating,
    food_rating_count = excluded.food_rating_count,
    updated_at = now();
$$;

-- ---------------------------------------------------------------------------
-- resolve_suburb_query  (p = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- places_in_bounding_box  (p = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- places_within_radius  (p = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- search_posts_by_dish  (p = posts, pl = places)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- search_posts_full_text  (p = posts, pl = places)
-- ---------------------------------------------------------------------------
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
  select p.id,
    p.search_tsv ||
    setweight(to_tsvector('simple', coalesce(ht.ht_names,'')), 'B') as tsv,
    p.search_tsv
  from public.posts p
  left join hashtag_text ht on ht.id = p.id
  where p.deleted_at is null
),
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

-- ---------------------------------------------------------------------------
-- search_places_full_text  (p = places)
-- ---------------------------------------------------------------------------
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
  open_now boolean, rank real
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
  ranked.open_now, ranked.rank
from ranked
order by rank desc, name asc
limit greatest(1, least(coalesce(max_results, 20), 50));
$$;

-- ---------------------------------------------------------------------------
-- suggest_searches  (p = places)
-- ---------------------------------------------------------------------------
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
