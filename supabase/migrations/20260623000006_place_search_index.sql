-- B-596: Materialised search index for places.
--
-- Before this migration, search RPCs computed lower(name), verification_score,
-- and proximity on raw `places` rows for every query. place_stats (post_count,
-- save_count, trending_score) was never joined in search despite existing as a
-- derived cache.
--
-- This migration:
--   1. Creates place_search_index with pre-computed search signals.
--   2. Indexes for GIN FTS, trigram name matching, cuisine, and popularity.
--   3. refresh_place_search_index(uuid): upsert function, called by triggers.
--   4. Triggers on places and place_stats to keep the index current.
--   5. Initial backfill from all active places.
--   6. Updates search_text_fallback to drive the place branch from the index.
--   7. Updates search_semantic place_candidates to include index signals in display_data.
--
-- Join count (place search path):
--   Before: places scan + per-row lower()/ilike + inline ST_Distance — 1 table, no pre-computation
--   After:  place_search_index scan (pre-computed search_name, lat/lng) + 1 join to places for display

-- ---------------------------------------------------------------------------
-- 1. Enable unaccent
-- ---------------------------------------------------------------------------

create extension if not exists unaccent schema extensions;

-- Ensure unaccent() resolves without schema prefix for all statements in this migration.
set search_path to public, extensions;

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------

create table public.place_search_index (
  place_id           uuid           not null primary key references public.places(id) on delete cascade,
  search_name        text           not null,
  search_tsv         tsvector       not null,
  cuisine_slug       text,
  suburb             text,
  verification_score numeric(4,2)   not null default 0.20,
  lat                double precision,
  lng                double precision,
  post_count         integer        not null default 0,
  save_count         integer        not null default 0,
  trending_score     numeric(6,3)   not null default 0,
  updated_at         timestamptz    not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index place_search_index_tsv_idx    on public.place_search_index using gin(search_tsv);
create index place_search_index_name_trgm  on public.place_search_index using gin(search_name extensions.gin_trgm_ops);
create index place_search_index_cuisine    on public.place_search_index(cuisine_slug);
create index place_search_index_post_count on public.place_search_index(post_count desc);
create index place_search_index_trending   on public.place_search_index(trending_score desc);

-- ---------------------------------------------------------------------------
-- 4. RLS (matches place_stats pattern: public read, service role manages)
-- ---------------------------------------------------------------------------

alter table public.place_search_index enable row level security;

drop policy if exists "Public read place_search_index" on public.place_search_index;
create policy "Public read place_search_index"
  on public.place_search_index for select using (true);

drop policy if exists "Service role manages place_search_index" on public.place_search_index;
create policy "Service role manages place_search_index"
  on public.place_search_index for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 6. Refresh function
-- ---------------------------------------------------------------------------

create or replace function public.refresh_place_search_index(p_place_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
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
    coalesce(ps.post_count,    0),
    coalesce(ps.save_count,    0),
    coalesce(ps.trending_score, 0),
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

-- ---------------------------------------------------------------------------
-- 7. Trigger function + triggers
-- ---------------------------------------------------------------------------

create or replace function public.trg_refresh_place_search_index()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_place_search_index(
    case tg_table_name when 'places' then new.id else new.place_id end
  );
  return null;
end;
$$;

create trigger trg_places_search_index
  after insert or update of
    name, cuisine_type, cuisine_slug, city, suburb,
    latitude, longitude, verification_level, place_status, deleted_at
  on public.places
  for each row execute function public.trg_refresh_place_search_index();

create trigger trg_place_stats_search_index
  after update of post_count, save_count, trending_score
  on public.place_stats
  for each row execute function public.trg_refresh_place_search_index();

-- ---------------------------------------------------------------------------
-- 8. Initial backfill
-- ---------------------------------------------------------------------------

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
  coalesce(ps.post_count,    0),
  coalesce(ps.save_count,    0),
  coalesce(ps.trending_score, 0),
  now()
from public.places p
left join public.place_stats ps on ps.place_id = p.id
where p.deleted_at is null
  and p.place_status = 'active'
on conflict (place_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Update search_text_fallback: drive place branch from place_search_index
-- ---------------------------------------------------------------------------
--
-- Before: FROM places p WHERE p.name ILIKE ... (per-row lower() + ilike scan)
-- After:  FROM place_search_index psi JOIN places p ... (pre-computed search_name)
--
-- Display JSONB still pulled from places (google_place_id, google_rating, etc.)
-- Dish branch is unchanged.

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
-- 10. Update search_semantic: include index signals in place display_data
-- ---------------------------------------------------------------------------
--
-- Adds verification_score, post_count, save_count, trending_score to the
-- place display_data JSONB. These are additive keys — existing consumers
-- parsing display_data are unaffected. Scoring/blending logic is unchanged.

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
