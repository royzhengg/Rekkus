-- PostGIS (geography type) lives in the extensions schema.
set search_path to public, extensions;

-- =============================================================================
-- merge_places(old, new, reason, merged_by) — atomic place canonicalisation
--
-- Re-points all FK references from old_place_id to new_place_id, records in
-- place_merge_log, soft-deletes the old place, and logs to
-- restaurant_audit_events.  Called by scripts/admin/osm/canonicalise.ts.
--
-- Safety invariants:
--   • old_place_id must exist and not already be deleted/merged.
--   • new_place_id must exist and be active.
--   • Posts/saves/collections are re-pointed; conflicts (e.g. user already saved
--     new place) are silently dropped — the duplicate row is removed instead.
-- =============================================================================

create or replace function public.merge_places(
  p_old_place_id  uuid,
  p_new_place_id  uuid,
  p_reason        text    default 'admin',
  p_merged_by     uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old             record;
  v_new             record;
  v_posts           integer := 0;
  v_saved           integer := 0;
  v_post_drafts     integer := 0;
  v_dishes          integer := 0;
  v_top_spots       integer := 0;
  v_pop_cache       integer := 0;
  v_collection_items integer := 0;
begin
  -- -------------------------------------------------------------------------
  -- Guard: same id
  -- -------------------------------------------------------------------------
  if p_old_place_id = p_new_place_id then
    raise exception 'merge_places: old and new place ids are the same (%)', p_old_place_id;
  end if;

  -- -------------------------------------------------------------------------
  -- Lock both rows to prevent concurrent merges
  -- -------------------------------------------------------------------------
  select id, name, deleted_at, merged_into_place_id
    into v_old
    from public.places
   where id = p_old_place_id
     for update;

  if not found then
    raise exception 'merge_places: old place % not found', p_old_place_id;
  end if;
  if v_old.deleted_at is not null then
    raise exception 'merge_places: old place % is already deleted/merged', p_old_place_id;
  end if;

  select id, name, deleted_at
    into v_new
    from public.places
   where id = p_new_place_id
     for update;

  if not found then
    raise exception 'merge_places: new place % not found', p_new_place_id;
  end if;
  if v_new.deleted_at is not null then
    raise exception 'merge_places: new place % is deleted; cannot merge into it', p_new_place_id;
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Re-point posts
  -- -------------------------------------------------------------------------
  update public.posts
     set place_id = p_new_place_id
   where place_id = p_old_place_id;
  get diagnostics v_posts = row_count;

  -- -------------------------------------------------------------------------
  -- 2. Re-point saved_places (skip if (user_id, new_place_id) already exists)
  -- -------------------------------------------------------------------------
  -- Delete rows that would conflict first, then update the rest.
  delete from public.saved_places sp_old
   where sp_old.place_id = p_old_place_id
     and exists (
       select 1 from public.saved_places sp_new
        where sp_new.user_id  = sp_old.user_id
          and sp_new.place_id = p_new_place_id
     );

  update public.saved_places
     set place_id = p_new_place_id
   where place_id = p_old_place_id;
  get diagnostics v_saved = row_count;

  -- -------------------------------------------------------------------------
  -- 3. Re-point post_drafts
  -- -------------------------------------------------------------------------
  update public.post_drafts
     set place_id = p_new_place_id
   where place_id = p_old_place_id;
  get diagnostics v_post_drafts = row_count;

  -- -------------------------------------------------------------------------
  -- 4. Re-point dishes (skip duplicate name_normalized conflicts)
  -- -------------------------------------------------------------------------
  delete from public.dishes d_old
   where d_old.place_id = p_old_place_id
     and exists (
       select 1 from public.dishes d_new
        where d_new.place_id       = p_new_place_id
          and d_new.name_normalized = d_old.name_normalized
     );

  update public.dishes
     set place_id = p_new_place_id
   where place_id = p_old_place_id;
  get diagnostics v_dishes = row_count;

  -- -------------------------------------------------------------------------
  -- 5. Re-point user_top_spots (skip conflicts)
  -- -------------------------------------------------------------------------
  delete from public.user_top_spots uts_old
   where uts_old.place_id = p_old_place_id
     and exists (
       select 1 from public.user_top_spots uts_new
        where uts_new.user_id  = uts_old.user_id
          and uts_new.place_id = p_new_place_id
     );

  update public.user_top_spots
     set place_id = p_new_place_id
   where place_id = p_old_place_id;
  get diagnostics v_top_spots = row_count;

  -- -------------------------------------------------------------------------
  -- 6. Re-point place_popularity_cache (upsert: keep higher counts)
  -- -------------------------------------------------------------------------
  -- If a row for new_place_id already exists, merge counts then delete old row.
  update public.place_popularity_cache new_row
     set post_count            = new_row.post_count            + coalesce(old_row.post_count, 0),
         interaction_count_30d = new_row.interaction_count_30d + coalesce(old_row.interaction_count_30d, 0),
         updated_at            = now()
    from public.place_popularity_cache old_row
   where old_row.place_id = p_old_place_id
     and new_row.place_id = p_new_place_id;

  -- If no new_place_id row existed, simply re-point
  update public.place_popularity_cache
     set place_id = p_new_place_id
   where place_id = p_old_place_id
     and not exists (
       select 1 from public.place_popularity_cache
        where place_id = p_new_place_id
     );

  -- Delete the now-orphaned old row if new_place_id row existed
  delete from public.place_popularity_cache
   where place_id = p_old_place_id;

  get diagnostics v_pop_cache = row_count;

  -- -------------------------------------------------------------------------
  -- 7. Re-point collection_items (polymorphic: target_type='place')
  -- -------------------------------------------------------------------------
  delete from public.collection_items ci_old
   where ci_old.target_type = 'place'
     and ci_old.target_id   = p_old_place_id
     and exists (
       select 1 from public.collection_items ci_new
        where ci_new.collection_id = ci_old.collection_id
          and ci_new.target_type   = 'place'
          and ci_new.target_id     = p_new_place_id
     );

  update public.collection_items
     set target_id = p_new_place_id
   where target_type = 'place'
     and target_id   = p_old_place_id;
  get diagnostics v_collection_items = row_count;

  -- -------------------------------------------------------------------------
  -- 8. Record in place_merge_log
  -- -------------------------------------------------------------------------
  insert into public.place_merge_log (old_place_id, new_place_id, merged_by, reason)
  values (p_old_place_id, p_new_place_id, p_merged_by, p_reason);

  -- -------------------------------------------------------------------------
  -- 9. Soft-delete old place
  -- -------------------------------------------------------------------------
  update public.places
     set deleted_at           = now(),
         merged_into_place_id = p_new_place_id
   where id = p_old_place_id;

  -- -------------------------------------------------------------------------
  -- 10. Audit event (append-only via restaurant_audit_events)
  -- -------------------------------------------------------------------------
  insert into public.restaurant_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    source_type,
    reason,
    before_summary,
    after_summary
  ) values (
    case when p_merged_by is null then 'system' else 'admin' end,
    p_merged_by,
    'place_merged',
    'place',
    p_old_place_id,
    p_reason,
    p_reason,
    jsonb_build_object(
      'old_place_id', p_old_place_id,
      'old_place_name', v_old.name
    ),
    jsonb_build_object(
      'new_place_id', p_new_place_id,
      'new_place_name', v_new.name,
      'posts_repointed', v_posts,
      'saves_repointed', v_saved,
      'post_drafts_repointed', v_post_drafts,
      'dishes_repointed', v_dishes,
      'top_spots_repointed', v_top_spots,
      'collection_items_repointed', v_collection_items
    )
  );

  return jsonb_build_object(
    'old_place_id',               p_old_place_id,
    'new_place_id',               p_new_place_id,
    'posts_repointed',            v_posts,
    'saves_repointed',            v_saved,
    'post_drafts_repointed',      v_post_drafts,
    'dishes_repointed',           v_dishes,
    'top_spots_repointed',        v_top_spots,
    'pop_cache_merged',           v_pop_cache,
    'collection_items_repointed', v_collection_items
  );
end;
$$;

-- Only service_role may call this function directly
revoke all on function public.merge_places(uuid, uuid, text, uuid) from public;
revoke all on function public.merge_places(uuid, uuid, text, uuid) from authenticated;
grant execute on function public.merge_places(uuid, uuid, text, uuid) to service_role;

-- =============================================================================
-- find_place_merge_candidates() — surface duplicate pairs for review
--
-- Requires pg_trgm (enabled below) and PostGIS.  Returns up to 500 candidate
-- pairs ordered by confidence desc.  The script picks the "winner" (new) as the
-- place with the higher verification_level enum ordinal; on tie, the older row
-- (lower created_at) wins.
-- =============================================================================

-- Ensure pg_trgm is available (safe; only creates if not already present)
create extension if not exists pg_trgm;

create or replace function public.find_place_merge_candidates(
  p_distance_metres float  default 100.0,
  p_name_sim_thresh float  default 0.80,
  p_limit           integer default 500
)
returns table (
  candidate_old_id    uuid,
  candidate_new_id    uuid,
  old_name            text,
  new_name            text,
  distance_m          float,
  name_similarity     float,
  match_reasons       text[],
  confidence          float
)
language sql
security definer
stable
set search_path = public, extensions
as $$
  with ordered_verification as (
    -- Map enum to ordinal so we can compare levels
    select unnest(enum_range(null::public.verification_level)) as lvl,
           generate_series(1, array_length(enum_range(null::public.verification_level), 1)) as ord
  ),
  candidate_pairs as (
    select
      p1.id          as id_a,
      p2.id          as id_b,
      p1.name        as name_a,
      p2.name        as name_b,
      p1.verification_level as vl_a,
      p2.verification_level as vl_b,
      p1.created_at  as created_a,
      p2.created_at  as created_b,
      st_distance(
        st_makepoint(p1.longitude, p1.latitude)::geography,
        st_makepoint(p2.longitude, p2.latitude)::geography
      )              as dist_m,
      similarity(p1.name, p2.name) as name_sim,
      -- phone match (requires join with place_contact)
      (pc1.phone is not null and pc1.phone = pc2.phone) as phone_match,
      -- website match
      (pc1.website is not null and lower(pc1.website) = lower(coalesce(pc2.website,''))) as website_match,
      -- google_place_id match
      (p1.google_place_id is not null and p1.google_place_id = p2.google_place_id) as gplid_match
    from public.places p1
    join public.places p2
         on p2.id > p1.id                            -- avoid bidirectional dups
        and p2.deleted_at is null
        and st_dwithin(
              st_makepoint(p1.longitude, p1.latitude)::geography,
              st_makepoint(p2.longitude, p2.latitude)::geography,
              p_distance_metres
            )
    left join public.place_contact pc1 on pc1.place_id = p1.id
    left join public.place_contact pc2 on pc2.place_id = p2.id
    where p1.deleted_at is null
      and p1.latitude  is not null
      and p1.longitude is not null
      and p2.latitude  is not null
      and p2.longitude is not null
  ),
  filtered as (
    select *
    from candidate_pairs
    where name_sim >= p_name_sim_thresh
       or phone_match
       or website_match
       or gplid_match
    -- exclude already-logged merges (either direction)
    and not exists (
      select 1 from public.place_merge_log ml
       where (ml.old_place_id = id_a and ml.new_place_id = id_b)
          or (ml.old_place_id = id_b and ml.new_place_id = id_a)
    )
  ),
  with_winner as (
    select
      f.*,
      ov_a.ord as ord_a,
      ov_b.ord as ord_b,
      -- winner = higher verification level; on tie, older place wins
      case
        when ov_b.ord > ov_a.ord then id_b
        when ov_a.ord > ov_b.ord then id_a
        when created_a <= created_b  then id_a
        else id_b
      end as winner_id,
      case
        when ov_b.ord > ov_a.ord then id_a
        when ov_a.ord > ov_b.ord then id_b
        when created_a <= created_b  then id_b
        else id_a
      end as loser_id,
      case
        when ov_b.ord > ov_a.ord then name_b
        when ov_a.ord > ov_b.ord then name_a
        when created_a <= created_b  then name_a
        else name_b
      end as winner_name,
      case
        when ov_b.ord > ov_a.ord then name_a
        when ov_a.ord > ov_b.ord then name_b
        when created_a <= created_b  then name_b
        else name_a
      end as loser_name,
      -- build reason array
      array_remove(array[
        case when name_sim >= p_name_sim_thresh then 'name_similarity' end,
        case when phone_match   then 'phone' end,
        case when website_match then 'website' end,
        case when gplid_match   then 'google_place_id' end
      ], null)::text[] as reasons,
      -- confidence: weighted by match signals (max 1.0)
      least(1.0,
        (case when name_sim >= p_name_sim_thresh then name_sim * 0.6  else 0 end) +
        (case when phone_match   then 0.25 else 0 end) +
        (case when website_match then 0.20 else 0 end) +
        (case when gplid_match   then 0.30 else 0 end)
      ) as confidence
    from filtered f
    join ordered_verification ov_a on ov_a.lvl = f.vl_a
    join ordered_verification ov_b on ov_b.lvl = f.vl_b
  )
  select
    loser_id          as candidate_old_id,
    winner_id         as candidate_new_id,
    loser_name        as old_name,
    winner_name       as new_name,
    dist_m            as distance_m,
    name_sim          as name_similarity,
    reasons           as match_reasons,
    confidence
  from with_winner
  order by confidence desc, dist_m asc
  limit p_limit;
$$;

revoke all on function public.find_place_merge_candidates(float, float, integer) from public;
revoke all on function public.find_place_merge_candidates(float, float, integer) from authenticated;
grant execute on function public.find_place_merge_candidates(float, float, integer) to service_role;
