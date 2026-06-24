-- Domain: Functions / Places
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Derived
-- Source of Truth: No

-- ---------------------------------------------------------------------------
-- B-603: place_stats trigger functions
-- ---------------------------------------------------------------------------

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
    if old.deleted_at is null and new.deleted_at is not null then
      if old.place_id is not null then
        update public.place_stats
        set post_count = greatest(0, post_count - 1), updated_at = now()
        where place_id = old.place_id;
      end if;
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
    end if;
  end if;
  return null;
end;
$$;

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

create or replace function public.trg_place_stats_from_collection_items()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type <> 'place' then return null; end if;
    insert into public.place_stats
      (place_id, collection_count, last_activity_at, updated_at)
    values (new.target_id, 1, new.created_at, now())
    on conflict (place_id) do update set
      collection_count = public.place_stats.collection_count + 1,
      last_activity_at = greatest(public.place_stats.last_activity_at, new.created_at),
      updated_at       = now();
  elsif tg_op = 'DELETE' then
    if old.target_type <> 'place' then return null; end if;
    update public.place_stats
    set collection_count = greatest(0, collection_count - 1), updated_at = now()
    where place_id = old.target_id;
  end if;
  return null;
end;
$$;

create or replace function public.repair_place_stats(p_place_id uuid default null)
returns void
language sql security definer set search_path = public
as $$
  with
  post_counts as (
    select place_id, count(*) as n
    from public.posts
    where deleted_at is null and place_id is not null
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
      select place_id, created_at as ts from public.posts
        where deleted_at is null and place_id is not null
          and (p_place_id is null or place_id = p_place_id)
      union all
      select place_id, created_at from public.saved_places
        where (p_place_id is null or place_id = p_place_id)
      union all
      select target_id, created_at from public.collection_items
        where target_type = 'place'
          and (p_place_id is null or target_id = p_place_id)
    ) src
    group by place_id
  )
  insert into public.place_stats
    (place_id, post_count, save_count, collection_count, last_activity_at, updated_at)
  select p.id, coalesce(pc.n,0), coalesce(sc.n,0), coalesce(cc.n,0), a.last_ts, now()
  from public.places p
  left join post_counts       pc on pc.place_id = p.id
  left join save_counts       sc on sc.place_id = p.id
  left join collection_counts cc on cc.place_id = p.id
  left join activity           a on a.place_id  = p.id
  where p_place_id is null or p.id = p_place_id
  on conflict (place_id) do update set
    post_count       = excluded.post_count,
    save_count       = excluded.save_count,
    collection_count = excluded.collection_count,
    last_activity_at = excluded.last_activity_at,
    updated_at       = now();
$$;

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
    select place_id, count(*) as n from public.posts
    where deleted_at is null and place_id is not null group by place_id
  ),
  save_counts as (
    select place_id, count(*) as n from public.saved_places group by place_id
  ),
  collection_counts as (
    select target_id as place_id, count(*) as n from public.collection_items
    where target_type = 'place' group by target_id
  )
  select ps.place_id, 'post_count'::text,
         ps.post_count::bigint, coalesce(pc.n,0)::bigint
  from public.place_stats ps left join post_counts pc on pc.place_id = ps.place_id
  where ps.post_count <> coalesce(pc.n,0)
  union all
  select ps.place_id, 'save_count'::text,
         ps.save_count::bigint, coalesce(sc.n,0)::bigint
  from public.place_stats ps left join save_counts sc on sc.place_id = ps.place_id
  where ps.save_count <> coalesce(sc.n,0)
  union all
  select ps.place_id, 'collection_count'::text,
         ps.collection_count::bigint, coalesce(cc.n,0)::bigint
  from public.place_stats ps left join collection_counts cc on cc.place_id = ps.place_id
  where ps.collection_count <> coalesce(cc.n,0)
  order by 1, 2;
$$;

-- refresh_place_popularity_cache
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
-- PLACE STATS TRIGGERS
-- ---------------------------------------------------------------------------

drop trigger if exists trg_posts_place_stats on public.posts;
create trigger trg_posts_place_stats
  after insert or delete or update of deleted_at, place_id
  on public.posts
  for each row execute function public.trg_place_stats_from_posts();

drop trigger if exists trg_saved_places_place_stats on public.saved_places;
create trigger trg_saved_places_place_stats
  after insert or delete
  on public.saved_places
  for each row execute function public.trg_place_stats_from_saves();

drop trigger if exists trg_collection_items_place_stats on public.collection_items;
create trigger trg_collection_items_place_stats
  after insert or delete
  on public.collection_items
  for each row execute function public.trg_place_stats_from_collection_items();
