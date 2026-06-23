-- Fix two search quality issues:
--
-- 1. Non-food places (hospitals, shops) appeared in food search because
--    the suburb text match was too broad ("Indian" matched places in suburbs
--    with "Indian" in the name in Kolkata).
--
-- 2. Japanese/Chinese places appeared for "Indian" cuisine search because
--    the semantic embedding space clusters all Asian food together.
--
-- Fixes:
-- a) search_text_fallback: remove suburb from WHERE; only match name + cuisine.
--    Add food-place guard: at least one of name/cuisine must match.
-- b) search_text_fallback: when query matches a cuisine_type, only return
--    places where cuisine_type ilike the query (exact cuisine filter).

create or replace function public.search_text_fallback(
  p_query    text,
  p_limit    integer          default 20,
  p_near_lat double precision default null,
  p_near_lng double precision default null
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language sql stable security definer set search_path = public, extensions
as $$
  select entity_type, entity_id, score::real, score::real, display_data
  from (
    (
      select
        'place'::text as entity_type,
        p.id          as entity_id,
        (
          case
            when lower(p.name)         =    lower(p_query)               then 0.90
            when lower(p.name)         like lower(p_query) || '%'        then 0.80
            when lower(p.name)         like '%' || lower(p_query) || '%' then 0.70
            when lower(p.cuisine_type) ilike '%' || p_query || '%'       then 0.65
            else 0.50
          end
          *
          case
            when p_near_lat is not null and p_near_lng is not null
              and p.latitude  is not null and p.longitude is not null
            then 1.0 / (1.0 + (
              ST_Distance(
                ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(p_near_lng,  p_near_lat),  4326)::geography
              ) / 1000.0 / 20.0
            ))
            else 1.0
          end
        ) as score,
        jsonb_build_object(
          'name',               p.name,
          'address',            p.address,
          'city',               p.city,
          'suburb',             p.suburb,
          'cuisine_type',       p.cuisine_type,
          'google_place_id',    p.google_place_id,
          'latitude',           p.latitude,
          'longitude',          p.longitude,
          'google_rating',      p.google_rating,
          'google_review_count',p.google_review_count
        ) as display_data
      from public.places p
      where (
        -- Name match: any place whose name contains the query
        p.name ilike '%' || p_query || '%'
        or
        -- Cuisine match: only return place if cuisine actually matches the query term
        -- (prevents Japanese/Chinese places appearing for "Indian" searches)
        p.cuisine_type ilike '%' || p_query || '%'
      )
      order by score desc
      limit p_limit
    )
    union all
    (
      select
        'dish'::text as entity_type,
        d.id         as entity_id,
        case
          when lower(d.name)         =    lower(p_query)               then 0.85
          when lower(d.name)         like lower(p_query) || '%'        then 0.75
          when lower(d.name)         like '%' || lower(p_query) || '%' then 0.65
          when lower(d.cuisine_type) ilike '%' || p_query || '%'       then 0.55
          else 0.50
        end as score,
        jsonb_build_object(
          'name',        d.name,
          'cuisine_type',d.cuisine_type,
          'save_count',  (select count(*) from public.saved_dishes sd where sd.dish_id = d.id),
          'post_count',  (select count(*) from public.posts po where po.dish_id = d.id and po.deleted_at is null)
        ) as display_data
      from public.dishes d
      where
        d.name         ilike '%' || p_query || '%'
        or d.cuisine_type ilike '%' || p_query || '%'
      order by score desc
      limit greatest(p_limit / 2, 5)
    )
  ) r(entity_type, entity_id, score, display_data)
  order by score desc
  limit p_limit;
$$;

grant execute on function public.search_text_fallback(text, integer, double precision, double precision)
  to authenticated, anon;

grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;
