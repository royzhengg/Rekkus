-- Add proximity boosting to search_text_fallback and search_semantic.
--
-- Without location the RPCs ordered by text score then google_rating, causing
-- a Melbourne restaurant with a high rating to rank above a Sydney restaurant
-- with the same text match when the user is in Sydney.
--
-- Proximity factor = 1 / (1 + distance_km / 20)
--   0 km  → 1.00  (no penalty)
--  20 km  → 0.50  (half score)
-- 100 km  → 0.17
-- 500 km  → 0.04
--
-- When no location is supplied the factor is 1.0 (existing behaviour preserved).

-- ---------------------------------------------------------------------------
-- search_text_fallback  (add p_near_lat, p_near_lng)
-- ---------------------------------------------------------------------------

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
            when lower(p.cuisine_type) ilike '%' || p_query || '%'       then 0.60
            when lower(p.suburb)       ilike '%' || p_query || '%'       then 0.55
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
      where
        p.name         ilike '%' || p_query || '%'
        or p.cuisine_type ilike '%' || p_query || '%'
        or p.suburb       ilike '%' || p_query || '%'
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

-- Keep the old 2-arg signature callable (Supabase overloads by arity)
grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- search_semantic  (add p_near_lat, p_near_lng; apply proximity to final_score)
-- ---------------------------------------------------------------------------

create or replace function public.search_semantic(
  query_embedding extensions.vector(384),
  p_user_id       uuid             default null,
  p_limit         integer          default 50,
  p_near_lat      double precision default null,
  p_near_lng      double precision default null
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  v_taste_vector extensions.vector(384);
begin
  if p_user_id is not null then
    select avg(e)::extensions.vector(384) into v_taste_vector
    from (
      (
        select p.embedding as e
        from public.saved_places sp
        join public.places p on p.id = sp.place_id
        where sp.user_id = p_user_id and p.embedding is not null
        order by sp.created_at desc
        limit 20
      )
      union all
      (
        select pe.embedding
        from public.saves s
        join public.post_embeddings pe on pe.post_id = s.post_id
        where s.user_id = p_user_id
        order by s.created_at desc
        limit 20
      )
      union all
      (
        select de.embedding
        from public.dish_embeddings de
        join public.saved_dishes sd on sd.dish_id = de.dish_id
        where sd.user_id = p_user_id
        order by sd.created_at desc
        limit 20
      )
    ) user_embeddings;
  end if;

  return query
  with place_candidates as (
    select
      'place'::text                                                         as entity_type,
      p.id                                                                  as entity_id,
      p.embedding                                                           as embedding,
      p.latitude                                                            as lat,
      p.longitude                                                           as lng,
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
        'google_review_count',p.google_review_count,
        'open_now',           p.open_now
      )                                                                     as display_data
    from public.places p
    where p.embedding is not null
    order by p.embedding <=> query_embedding
    limit 20
  ),
  post_candidates as (
    select
      'post'::text                                                          as entity_type,
      pe.post_id                                                            as entity_id,
      pe.embedding                                                          as embedding,
      null::double precision                                                as lat,
      null::double precision                                                as lng,
      jsonb_build_object('post_id', pe.post_id)                            as display_data
    from public.post_embeddings pe
    join public.posts po on po.id = pe.post_id and po.deleted_at is null
    order by pe.embedding <=> query_embedding
    limit 20
  ),
  dish_candidates as (
    select
      'dish'::text                                                          as entity_type,
      de.dish_id                                                            as entity_id,
      de.embedding                                                          as embedding,
      null::double precision                                                as lat,
      null::double precision                                                as lng,
      jsonb_build_object(
        'name',         d.name,
        'cuisine_type', d.cuisine_type,
        'top_photo_url', (
          select coalesce(pp.processed_url, pp.thumbnail_url)
          from public.posts po2
          join public.post_photos pp on pp.post_id = po2.id and pp.deleted_at is null
          where po2.dish_id = d.id
            and po2.deleted_at is null
            and pp.media_type = 'image'
          order by po2.created_at desc
          limit 1
        ),
        'save_count', (select count(*) from public.saved_dishes sd2 where sd2.dish_id = d.id),
        'post_count', (select count(*) from public.posts po3 where po3.dish_id = d.id and po3.deleted_at is null)
      )                                                                     as display_data
    from public.dish_embeddings de
    join public.dishes d on d.id = de.dish_id
    order by de.embedding <=> query_embedding
    limit 20
  ),
  all_candidates as (
    select * from place_candidates
    union all
    select * from post_candidates
    union all
    select * from dish_candidates
  )
  select
    c.entity_type,
    c.entity_id,
    (1 - (c.embedding <=> query_embedding))::real                          as semantic_similarity,
    (
      case
        when v_taste_vector is not null then
          0.7 * (1 - (c.embedding <=> query_embedding))
          + 0.3 * (1 - (c.embedding <=> v_taste_vector))
        else
          (1 - (c.embedding <=> query_embedding))
      end
      *
      case
        when p_near_lat is not null and p_near_lng is not null
          and c.lat is not null and c.lng is not null
        then 1.0 / (1.0 + (
          ST_Distance(
            ST_SetSRID(ST_MakePoint(c.lng, c.lat),       4326)::geography,
            ST_SetSRID(ST_MakePoint(p_near_lng, p_near_lat), 4326)::geography
          ) / 1000.0 / 20.0
        ))
        else 1.0
      end
    )::real                                                                 as final_score,
    c.display_data
  from all_candidates c
  where (1 - (c.embedding <=> query_embedding)) > 0.4
  order by final_score desc
  limit p_limit;
end;
$$;

grant execute on function public.search_semantic(extensions.vector, uuid, integer, double precision, double precision)
  to authenticated, anon;

grant execute on function public.search_semantic(extensions.vector, uuid, integer)
  to authenticated, anon;
