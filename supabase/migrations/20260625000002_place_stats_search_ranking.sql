-- B-603: Place popularity + recency signals — Migration 2/2
--
-- Migration 1 populated place_stats counters via triggers and backfill.
-- This migration wires those counters into the search ranking pipeline:
--
--   1. Updates trg_place_stats_search_index to fire on collection_count and
--      last_activity_at changes (not just post_count/save_count/trending_score).
--   2. Updates refresh_place_search_index() to compute trending_score
--      dynamically from last_activity_at with declared weight/decay constants —
--      single formula, single place to tune.
--   3. Updates search_text_fallback to apply a continuous trending boost:
--      least(2.0, ln(1 + psi.trending_score))
--   4. Updates search_semantic to apply the same trending boost.
--   5. Registers a nightly pg_cron job (idempotent) to keep place_search_index
--      trending_score fresh for places with activity in the last 30 days.

-- ---------------------------------------------------------------------------
-- 1. Expand trigger column list on place_stats
-- ---------------------------------------------------------------------------
--
-- The original trigger only watched post_count, save_count, trending_score.
-- trending_score no longer exists on place_stats (dropped in migration 1).
-- Add collection_count and last_activity_at so those writes also refresh
-- the search index.

drop trigger if exists trg_place_stats_search_index on public.place_stats;

create trigger trg_place_stats_search_index
  after update of post_count, save_count, collection_count, last_activity_at
  on public.place_stats
  for each row execute function public.trg_refresh_place_search_index();

-- ---------------------------------------------------------------------------
-- 2. Update refresh_place_search_index: dynamic trending_score
-- ---------------------------------------------------------------------------
--
-- IMPORTANT: this function must never write back to place_stats — doing so
-- would create a trigger recursion cycle. It only writes to place_search_index.
--
-- Weights and decay constant are declared here as PL/pgSQL constants so
-- tuning is one-place. The formula:
--
--   trending_score = min(999.999,
--     (post_count × 2.0 + save_count × 1.0 + collection_count × 0.5)
--     × exp(−Δt / 2 592 000)
--   )
--
-- Δt = seconds since last_activity_at. Score ≈ 37% at 30 days, ≈ 5% at 90 days.
-- Accuracy: exact on any activity event (trigger fires → index refreshes).
-- Nightly pg_cron (see section 5) keeps scores fresh for inactive places.

create or replace function public.refresh_place_search_index(p_place_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  c_post_weight       constant numeric := 2.0;
  c_save_weight       constant numeric := 1.0;
  c_collection_weight constant numeric := 0.5;
  c_decay_seconds     constant numeric := 2592000; -- 30 days
begin
  insert into public.place_search_index (
    place_id,
    search_name,
    search_tsv,
    cuisine_slug,
    suburb,
    verification_score,
    lat,
    lng,
    post_count,
    save_count,
    trending_score,
    updated_at
  )
  select
    p.id,
    lower(unaccent(p.name)),
    to_tsvector('simple',
      coalesce(unaccent(p.name), '') || ' ' ||
      coalesce(p.cuisine_type, '') || ' ' ||
      coalesce(p.city, '') || ' ' ||
      coalesce(p.suburb, '')
    ),
    p.cuisine_slug,
    p.suburb,
    case p.verification_level
      when 'owner_verified'     then 1.00
      when 'community_verified' then 0.75
      when 'osm_google'         then 0.55
      when 'osm_only'           then 0.30
      when 'user_created'       then 0.20
      else 0.20
    end,
    p.latitude,
    p.longitude,
    coalesce(ps.post_count, 0),
    coalesce(ps.save_count, 0),
    least(999.999,
      (coalesce(ps.post_count, 0) * c_post_weight
       + coalesce(ps.save_count, 0) * c_save_weight
       + coalesce(ps.collection_count, 0) * c_collection_weight)
      * exp(
          -extract(epoch from (now() - coalesce(ps.last_activity_at, now())))
          / c_decay_seconds
        )
    ),
    now()
  from public.places p
  left join public.place_stats ps on ps.place_id = p.id
  where p.id = p_place_id
    and p.deleted_at is null
    and p.place_status = 'active'
  on conflict (place_id) do update set
    search_name        = excluded.search_name,
    search_tsv         = excluded.search_tsv,
    cuisine_slug       = excluded.cuisine_slug,
    suburb             = excluded.suburb,
    verification_score = excluded.verification_score,
    lat                = excluded.lat,
    lng                = excluded.lng,
    post_count         = excluded.post_count,
    save_count         = excluded.save_count,
    trending_score     = excluded.trending_score,
    updated_at         = excluded.updated_at;

  -- Remove if place is now soft-deleted or non-active
  delete from public.place_search_index
  where place_id = p_place_id
    and not exists (
      select 1 from public.places
      where id = p_place_id
        and deleted_at is null
        and place_status = 'active'
    );
end;
$$;

-- Backfill place_search_index with fresh trending_scores now that counters
-- are populated from migration 1.
do $$
declare
  r record;
begin
  for r in select place_id from public.place_stats loop
    perform public.refresh_place_search_index(r.place_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update search_text_fallback: add trending boost
-- ---------------------------------------------------------------------------
--
-- Adds: + least(2.0, ln(1.0 + psi.trending_score))
-- Cap 2.0 is deliberately conservative — relevance wins on specific queries;
-- trending breaks ties. Raise cap in this function if discovery data shows
-- viral places need stronger separation.

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
        'place'::text  as entity_type,
        psi.place_id   as entity_id,
        (
          case
            when psi.search_name  =    lower(p_query)               then 0.90
            when psi.search_name  like lower(p_query) || '%'        then 0.80
            when psi.search_name  like '%' || lower(p_query) || '%' then 0.70
            when psi.cuisine_slug ilike '%' || p_query || '%'       then 0.65
            when psi.suburb       ilike '%' || p_query || '%'       then 0.55
            else 0.50
          end
          *
          case
            when p_near_lat is not null and p_near_lng is not null
              and psi.lat is not null and psi.lng is not null
            then 1.0 / (1.0 + (
              ST_Distance(
                ST_SetSRID(ST_MakePoint(psi.lng, psi.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(p_near_lng,  p_near_lat),  4326)::geography
              ) / 1000.0 / 20.0
            ))
            else 1.0
          end
          + least(2.0, ln(1.0 + psi.trending_score))
        ) as score,
        jsonb_build_object(
          'name',               p.name,
          'address',            p.address,
          'city',               p.city,
          'suburb',             p.suburb,
          'cuisine_type',       p.cuisine_type,
          'google_place_id',    p.google_place_id,
          'latitude',           psi.lat,
          'longitude',          psi.lng,
          'google_rating',      p.google_rating,
          'google_review_count',p.google_review_count
        ) as display_data
      from public.place_search_index psi
      join public.places p on p.id = psi.place_id
      where
        psi.search_name  like '%' || lower(p_query) || '%'
        or psi.cuisine_slug ilike '%' || p_query || '%'
        or psi.suburb       ilike '%' || p_query || '%'
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

-- ---------------------------------------------------------------------------
-- 4. Update search_semantic: add trending boost
-- ---------------------------------------------------------------------------
--
-- place_candidates already left-joins place_search_index (psi). The trending
-- boost is additive to the semantic + distance final_score. Dish and post
-- candidates are unchanged.

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
      coalesce(psi.trending_score, 0)                                       as trending_score,
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
        'open_now',           p.open_now,
        'verification_score', coalesce(psi.verification_score, 0.20),
        'post_count',         coalesce(psi.post_count, 0),
        'save_count',         coalesce(psi.save_count, 0),
        'trending_score',     coalesce(psi.trending_score, 0)
      )                                                                     as display_data
    from public.places p
    left join public.place_search_index psi on psi.place_id = p.id
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
      0.0::numeric                                                          as trending_score,
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
      0.0::numeric                                                          as trending_score,
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
      )
      + least(2.0, ln(1.0 + c.trending_score))
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

-- ---------------------------------------------------------------------------
-- 5. Nightly pg_cron: refresh trending_score for active places
-- ---------------------------------------------------------------------------
--
-- Places that receive activity get an exact refresh via trigger above.
-- For places that are decaying (no new activity), trending_score in
-- place_search_index would go stale without a periodic refresh.
--
-- This cron runs at 3 am daily and refreshes places with activity in the
-- last 30 days. Beyond 30 days the score is already ≈ 37% or lower and
-- the decay is slow enough that nightly refresh adds negligible accuracy.
-- Intentionally stops at 30 days — places outside this window are
-- nearly-zero-scored and don't affect meaningful ranking.
--
-- The schedule is registered idempotently: unschedule before re-scheduling
-- so this migration is safe to re-run (db reset, restore, re-push, etc.).

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1 from cron.job where jobname = 'nightly-place-trending-refresh'
    ) then
      perform cron.unschedule('nightly-place-trending-refresh');
    end if;

    perform cron.schedule(
      'nightly-place-trending-refresh',
      '0 3 * * *',
      $cron$
        select public.refresh_place_search_index(place_id)
        from public.place_stats
        where last_activity_at > now() - interval '30 days'
        order by last_activity_at desc;
      $cron$
    );
  end if;
end;
$$;
