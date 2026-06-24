-- B-603: Place popularity + recency signals — Migration 1/2
--
-- Architecture boundary enforced here:
--   place_stats         = raw factual counters ONLY (post_count, save_count,
--                         collection_count, last_activity_at).
--   place_search_index  = derived ranking signals (trending_score lives there,
--                         not here).
--
-- This migration:
--   1. Drops stale trending_score column from place_stats.
--   2. Upgrades post_count / save_count / collection_count to bigint.
--   3. Adds indexes required for trigger write-path and nightly cron.
--   4. Creates trigger functions on posts, saved_places, collection_items.
--   5. Creates repair_place_stats() and validate_place_stats() helpers.
--   6. Backfills counters via repair_place_stats(NULL).

-- ---------------------------------------------------------------------------
-- 1. Drop stale trending_score from place_stats
-- ---------------------------------------------------------------------------

-- The existing trg_place_stats_search_index trigger (from B-596) watches
-- trending_score. Drop it first so the column drop succeeds.
-- Migration 2 recreates the trigger with the correct column list.
drop trigger if exists trg_place_stats_search_index on public.place_stats;

alter table public.place_stats drop column if exists trending_score;
drop index if exists public.idx_place_stats_trending;

-- Update comment to reflect the boundary invariant.
comment on table public.place_stats is
  'Raw factual counters only (post_count, save_count, collection_count, '
  'last_activity_at). Derived ranking signals such as trending_score live in '
  'place_search_index. Never write derived scores here.';

-- ---------------------------------------------------------------------------
-- 2. Upgrade counters to bigint
-- ---------------------------------------------------------------------------

alter table public.place_stats
  alter column post_count       type bigint using post_count::bigint,
  alter column save_count       type bigint using save_count::bigint,
  alter column collection_count type bigint using collection_count::bigint;

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Trigger write-path: counter updates look up place_stats by place_id (PK)
-- and the source tables look up rows by place_id.
create index if not exists posts_place_id_idx
  on public.posts (place_id) where place_id is not null;

create index if not exists saved_places_place_id_idx
  on public.saved_places (place_id);

-- Nightly cron filters place_stats by last_activity_at; prevents seq scan.
create index if not exists idx_place_stats_last_activity
  on public.place_stats (last_activity_at);

-- collection_items already has: collection_items_target_idx on (target_type, target_id) ✓

-- ---------------------------------------------------------------------------
-- 4a. Trigger function: posts → place_stats
-- ---------------------------------------------------------------------------
--
-- Fired AFTER INSERT OR DELETE OR UPDATE OF deleted_at, place_id ON posts.
-- All counter writes use arithmetic on the current DB value (place_stats.n + 1)
-- so concurrent inserts/deletes cannot clobber each other.
--
-- last_activity_at uses the event's own created_at/updated_at (not now()) so
-- historical imports and backfills produce correct decay timestamps.
--
-- Edge cases:
--   INSERT, place_id IS NOT NULL, deleted_at IS NULL → increment
--   DELETE, OLD.deleted_at IS NULL                   → decrement
--   UPDATE: deleted_at null→non-null (soft delete)   → decrement old place
--   UPDATE: deleted_at non-null→null (undelete)      → increment new place
--   UPDATE: place_id X→Y, post is live               → decrement X, increment Y
--   UPDATE: place_id X→Y, post is already deleted    → no-op (never counted)

create or replace function public.trg_place_stats_from_posts()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.place_id is not null and new.deleted_at is null then
      insert into public.place_stats
        (place_id, post_count, last_activity_at, updated_at)
      values (new.place_id, 1, new.created_at, now())
      on conflict (place_id) do update set
        post_count       = public.place_stats.post_count + 1,
        last_activity_at = greatest(public.place_stats.last_activity_at, new.created_at),
        updated_at       = now();
    end if;

  elsif tg_op = 'DELETE' then
    if old.place_id is not null and old.deleted_at is null then
      update public.place_stats
      set post_count = greatest(0, post_count - 1), updated_at = now()
      where place_id = old.place_id;
    end if;

  elsif tg_op = 'UPDATE' then
    -- Soft-delete: was live, now deleted
    if old.deleted_at is null and new.deleted_at is not null then
      if old.place_id is not null then
        update public.place_stats
        set post_count = greatest(0, post_count - 1), updated_at = now()
        where place_id = old.place_id;
      end if;

    -- Undelete: was deleted, now live
    elsif old.deleted_at is not null and new.deleted_at is null then
      if new.place_id is not null then
        insert into public.place_stats
          (place_id, post_count, last_activity_at, updated_at)
        values (new.place_id, 1, new.updated_at, now())
        on conflict (place_id) do update set
          post_count       = public.place_stats.post_count + 1,
          last_activity_at = greatest(public.place_stats.last_activity_at, new.updated_at),
          updated_at       = now();
      end if;

    -- place_id change while post is live (not soft-deleted)
    elsif old.place_id is distinct from new.place_id and new.deleted_at is null then
      if old.place_id is not null then
        update public.place_stats
        set post_count = greatest(0, post_count - 1), updated_at = now()
        where place_id = old.place_id;
      end if;
      if new.place_id is not null then
        insert into public.place_stats
          (place_id, post_count, last_activity_at, updated_at)
        values (new.place_id, 1, new.updated_at, now())
        on conflict (place_id) do update set
          post_count       = public.place_stats.post_count + 1,
          last_activity_at = greatest(public.place_stats.last_activity_at, new.updated_at),
          updated_at       = now();
      end if;
      -- else: place_id changed while post is soft-deleted → no-op
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_posts_place_stats on public.posts;
create trigger trg_posts_place_stats
  after insert or delete or update of deleted_at, place_id
  on public.posts
  for each row execute function public.trg_place_stats_from_posts();

-- ---------------------------------------------------------------------------
-- 4b. Trigger function: saved_places → place_stats
-- ---------------------------------------------------------------------------
--
-- saved_places has no soft-delete; INSERT/DELETE only.
-- last_activity_at = NEW.created_at (event timestamp, not now()).
-- Unsaves decrement the counter but do not roll back last_activity_at —
-- score stays anchored to last positive engagement event.

create or replace function public.trg_place_stats_from_saves()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.place_stats
      (place_id, save_count, last_activity_at, updated_at)
    values (new.place_id, 1, new.created_at, now())
    on conflict (place_id) do update set
      save_count       = public.place_stats.save_count + 1,
      last_activity_at = greatest(public.place_stats.last_activity_at, new.created_at),
      updated_at       = now();
  elsif tg_op = 'DELETE' then
    update public.place_stats
    set save_count = greatest(0, save_count - 1), updated_at = now()
    where place_id = old.place_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_saved_places_place_stats on public.saved_places;
create trigger trg_saved_places_place_stats
  after insert or delete
  on public.saved_places
  for each row execute function public.trg_place_stats_from_saves();

-- ---------------------------------------------------------------------------
-- 4c. Trigger function: collection_items → place_stats
-- ---------------------------------------------------------------------------
--
-- collection_items is polymorphic (target_type IN ('place','post','dish')).
-- We only count rows where target_type = 'place'.
-- UNIQUE (collection_id, target_type, target_id) prevents the same place
-- appearing twice in one collection, so count(*) = count(distinct collection_id).

create or replace function public.trg_place_stats_from_collection_items()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type <> 'place' then
      return null;
    end if;
    insert into public.place_stats
      (place_id, collection_count, last_activity_at, updated_at)
    values (new.target_id, 1, new.created_at, now())
    on conflict (place_id) do update set
      collection_count = public.place_stats.collection_count + 1,
      last_activity_at = greatest(public.place_stats.last_activity_at, new.created_at),
      updated_at       = now();
  elsif tg_op = 'DELETE' then
    if old.target_type <> 'place' then
      return null;
    end if;
    update public.place_stats
    set collection_count = greatest(0, collection_count - 1), updated_at = now()
    where place_id = old.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_collection_items_place_stats on public.collection_items;
create trigger trg_collection_items_place_stats
  after insert or delete
  on public.collection_items
  for each row execute function public.trg_place_stats_from_collection_items();

-- ---------------------------------------------------------------------------
-- 5a. Repair function: rebuild counters from source tables
-- ---------------------------------------------------------------------------
--
-- Uses aggregate CTEs (one scan per source table, then join) — not correlated
-- subqueries. Safe to run on large datasets.
-- Pass NULL to repair all rows; pass a specific uuid to repair one place.
-- Use for: migration verification, drift recovery, manual ops.
-- Not for continuous monitoring (cost scales with dataset size).

create or replace function public.repair_place_stats(p_place_id uuid default null)
returns void
language sql security definer set search_path = public
as $$
  with
  post_counts as (
    select place_id, count(*) as n
    from public.posts
    where deleted_at is null
      and place_id is not null
      and (p_place_id is null or place_id = p_place_id)
    group by place_id
  ),
  save_counts as (
    select place_id, count(*) as n
    from public.saved_places
    where (p_place_id is null or place_id = p_place_id)
    group by place_id
  ),
  collection_counts as (
    select target_id as place_id, count(*) as n
    from public.collection_items
    where target_type = 'place'
      and (p_place_id is null or target_id = p_place_id)
    group by target_id
  ),
  activity as (
    select place_id, max(ts) as last_ts
    from (
      select place_id, created_at as ts
      from public.posts
      where deleted_at is null
        and place_id is not null
        and (p_place_id is null or place_id = p_place_id)
      union all
      select place_id, created_at
      from public.saved_places
      where (p_place_id is null or place_id = p_place_id)
      union all
      select target_id, created_at
      from public.collection_items
      where target_type = 'place'
        and (p_place_id is null or target_id = p_place_id)
    ) src
    group by place_id
  )
  insert into public.place_stats
    (place_id, post_count, save_count, collection_count, last_activity_at, updated_at)
  select
    p.id,
    coalesce(pc.n, 0),
    coalesce(sc.n, 0),
    coalesce(cc.n, 0),
    a.last_ts,
    now()
  from public.places p
  left join post_counts        pc on pc.place_id = p.id
  left join save_counts        sc on sc.place_id = p.id
  left join collection_counts  cc on cc.place_id = p.id
  left join activity            a on a.place_id  = p.id
  where p_place_id is null or p.id = p_place_id
  on conflict (place_id) do update set
    post_count       = excluded.post_count,
    save_count       = excluded.save_count,
    collection_count = excluded.collection_count,
    last_activity_at = excluded.last_activity_at,
    updated_at       = now();
$$;

-- ---------------------------------------------------------------------------
-- 5b. Validate function: detect counter drift
-- ---------------------------------------------------------------------------
--
-- Returns rows where stored counter differs from recount by ≥ 1.
-- Aggregate CTEs — one scan per source table.
-- Use for admin diagnostics and migration smoke tests only.

create or replace function public.validate_place_stats()
returns table (
  place_id     uuid,
  field        text,
  stored_value bigint,
  actual_value bigint
)
language sql security definer set search_path = public
as $$
  with
  post_counts as (
    select place_id, count(*) as n
    from public.posts
    where deleted_at is null and place_id is not null
    group by place_id
  ),
  save_counts as (
    select place_id, count(*) as n
    from public.saved_places
    group by place_id
  ),
  collection_counts as (
    select target_id as place_id, count(*) as n
    from public.collection_items
    where target_type = 'place'
    group by target_id
  )
  select ps.place_id, 'post_count'::text,
         ps.post_count::bigint, coalesce(pc.n, 0)::bigint
  from public.place_stats ps
  left join post_counts pc on pc.place_id = ps.place_id
  where ps.post_count <> coalesce(pc.n, 0)
  union all
  select ps.place_id, 'save_count'::text,
         ps.save_count::bigint, coalesce(sc.n, 0)::bigint
  from public.place_stats ps
  left join save_counts sc on sc.place_id = ps.place_id
  where ps.save_count <> coalesce(sc.n, 0)
  union all
  select ps.place_id, 'collection_count'::text,
         ps.collection_count::bigint, coalesce(cc.n, 0)::bigint
  from public.place_stats ps
  left join collection_counts cc on cc.place_id = ps.place_id
  where ps.collection_count <> coalesce(cc.n, 0)
  order by 1, 2;
$$;

grant execute on function public.repair_place_stats(uuid)   to service_role;
grant execute on function public.validate_place_stats()      to service_role;

-- ---------------------------------------------------------------------------
-- 6. Backfill
-- ---------------------------------------------------------------------------

select public.repair_place_stats(null);
