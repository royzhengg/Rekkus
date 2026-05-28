-- Search prefix matching: allow partial-word searches (e.g. "Tonkat" matches "Tonkatsu")
-- Rebuilds search_restaurants_full_text and search_posts_full_text to OR a prefix tsquery
-- alongside the existing websearch_to_tsquery, so results appear as the user types.
-- suggest_searches already used this :* pattern; this brings the main search RPCs in line.
-- Depends on: 20240223000000_search_enrichment.sql

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
