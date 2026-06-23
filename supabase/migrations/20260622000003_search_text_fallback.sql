-- Text search fallback for when vector search returns no results.
--
-- Returns the same column shape as search_semantic so useSearch.ts
-- can process both paths identically without branching.
--
-- Graded similarity scores by match quality:
--   exact name    → 0.90 / 0.85
--   prefix match  → 0.80 / 0.75
--   contains      → 0.70 / 0.65
--   cuisine type  → 0.60 / 0.55
--   suburb        → 0.55

create or replace function public.search_text_fallback(
  p_query  text,
  p_limit  integer default 20
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language sql stable security definer set search_path = public
as $$
  select entity_type, entity_id, score::real, score::real, display_data
  from (
    (
      select
        'place'::text as entity_type,
        p.id          as entity_id,
        case
          when lower(p.name)         =    lower(p_query)               then 0.90
          when lower(p.name)         like lower(p_query) || '%'        then 0.80
          when lower(p.name)         like '%' || lower(p_query) || '%' then 0.70
          when lower(p.cuisine_type) ilike '%' || p_query || '%'       then 0.60
          when lower(p.suburb)       ilike '%' || p_query || '%'       then 0.55
          else 0.50
        end as score,
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
      where
        p.name         ilike '%' || p_query || '%'
        or p.cuisine_type ilike '%' || p_query || '%'
        or p.suburb       ilike '%' || p_query || '%'
      order by score desc, p.google_rating desc nulls last
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

grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;
