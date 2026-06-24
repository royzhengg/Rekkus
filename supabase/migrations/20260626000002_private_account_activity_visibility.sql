-- B-621: Private account follow requests and activity visibility enforcement.
-- Privacy authority is centralised in can_view_user_content(); client UI is
-- presentation only.

-- ─── follow_requests ────────────────────────────────────────────────────────

create table if not exists public.follow_requests (
  id           uuid        default gen_random_uuid() primary key,
  requester_id uuid        references public.users on delete cascade not null,
  target_id    uuid        references public.users on delete cascade not null,
  status       text        not null default 'pending'
                            check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (requester_id <> target_id)
);

create index if not exists follows_following_follower_idx
  on public.follows (following_id, follower_id);

create index if not exists user_blocks_blocked_blocker_idx
  on public.user_blocks (blocked_id, blocker_id);

create index if not exists follow_requests_requester_target_idx
  on public.follow_requests (requester_id, target_id, created_at desc);

create index if not exists follow_requests_target_status_idx
  on public.follow_requests (target_id, status, created_at desc);

create unique index if not exists follow_requests_one_pending_idx
  on public.follow_requests (requester_id, target_id)
  where status = 'pending';

alter table public.follow_requests enable row level security;

drop policy if exists "users can view their own follow requests" on public.follow_requests;
create policy "Users can view their own follow requests"
  on public.follow_requests for select
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- Mutations go through RPCs so transitions stay idempotent and auditable.
drop policy if exists "no direct client follow request mutations" on public.follow_requests;
create policy "No direct client follow request mutations"
  on public.follow_requests for all
  using (false)
  with check (false);

create table if not exists public.follow_request_audit_events (
  id                uuid        default gen_random_uuid() primary key,
  follow_request_id uuid        references public.follow_requests on delete set null,
  requester_id      uuid        references public.users on delete set null,
  target_id         uuid        references public.users on delete set null,
  actor_id          uuid        references public.users on delete set null,
  event_type        text        not null
                                  check (event_type in ('requested', 'cancelled', 'approved', 'declined', 'blocked_cancelled')),
  context           jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

alter table public.follow_request_audit_events enable row level security;

drop policy if exists "no direct client access to follow request audit events" on public.follow_request_audit_events;
create policy "No direct client access to follow request audit events"
  on public.follow_request_audit_events for all
  using (false);

create index if not exists follow_request_audit_events_request_idx
  on public.follow_request_audit_events (follow_request_id, created_at desc);

create index if not exists follow_request_audit_events_target_idx
  on public.follow_request_audit_events (target_id, created_at desc);

create or replace function public.record_follow_request_audit_event(
  p_follow_request_id uuid,
  p_requester_id uuid,
  p_target_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.follow_request_audit_events (
    follow_request_id, requester_id, target_id, actor_id, event_type, context
  )
  values (
    p_follow_request_id, p_requester_id, p_target_id, p_actor_id, p_event_type,
    coalesce(p_context, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.record_follow_request_audit_event(uuid, uuid, uuid, uuid, text, jsonb) from public;
grant execute on function public.record_follow_request_audit_event(uuid, uuid, uuid, uuid, text, jsonb) to authenticated;

-- ─── central authority ──────────────────────────────────────────────────────

create or replace function public.has_user_block_between(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_id = viewer_id and ub.blocked_id = target_id)
       or (ub.blocker_id = target_id and ub.blocked_id = viewer_id)
  );
$$;

create or replace function public.can_view_user_content(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_id is not null
    and (
      viewer_id = target_id
      or (
        not coalesce((
          select us.private_account
          from public.user_settings us
          where us.id = target_id
        ), false)
        and (viewer_id is null or not public.has_user_block_between(viewer_id, target_id))
      )
      or (
        viewer_id is not null
        and not public.has_user_block_between(viewer_id, target_id)
        and exists (
          select 1
          from public.follows f
          where f.follower_id = viewer_id
            and f.following_id = target_id
        )
      )
    );
$$;

grant execute on function public.has_user_block_between(uuid, uuid) to authenticated, anon;
grant execute on function public.can_view_user_content(uuid, uuid) to authenticated, anon;

-- ─── request/follow RPCs ────────────────────────────────────────────────────

create or replace function public.follow_relationship_state(p_target_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or p_target_id is null or actor_id = p_target_id then
    return 'none';
  end if;

  if exists (
    select 1 from public.follows
    where follower_id = actor_id and following_id = p_target_id
  ) then
    return 'following';
  end if;

  if exists (
    select 1 from public.follow_requests
    where requester_id = actor_id
      and target_id = p_target_id
      and status = 'pending'
  ) then
    return 'requested';
  end if;

  return 'none';
end;
$$;

create or replace function public.request_follow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  is_private boolean;
  request_id uuid;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_target_id is null or actor_id = p_target_id then
    raise exception 'invalid_follow_target';
  end if;
  if public.has_user_block_between(actor_id, p_target_id) then
    raise exception 'follow_blocked';
  end if;

  if exists (
    select 1 from public.follows
    where follower_id = actor_id and following_id = p_target_id
  ) then
    return 'following';
  end if;

  select coalesce(us.private_account, false)
  into is_private
  from public.users u
  left join public.user_settings us on us.id = u.id
  where u.id = p_target_id;

  if not found then
    raise exception 'follow_target_not_found';
  end if;

  if not is_private then
    insert into public.follows (follower_id, following_id)
    values (actor_id, p_target_id)
    on conflict (follower_id, following_id) do nothing;

    update public.follow_requests
    set status = 'cancelled', updated_at = now(), resolved_at = now()
    where requester_id = actor_id and target_id = p_target_id and status = 'pending';

    return 'following';
  end if;

  select id into request_id
  from public.follow_requests
  where requester_id = actor_id and target_id = p_target_id and status = 'pending'
  limit 1;

  if request_id is null then
    insert into public.follow_requests (requester_id, target_id)
    values (actor_id, p_target_id)
    returning id into request_id;

    perform public.record_follow_request_audit_event(
      request_id, actor_id, p_target_id, actor_id, 'requested', '{}'::jsonb
    );
  end if;

  return 'requested';
end;
$$;

create or replace function public.cancel_follow_request(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_record record;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.follow_requests
  set status = 'cancelled', updated_at = now(), resolved_at = now()
  where requester_id = actor_id
    and target_id = p_target_id
    and status = 'pending'
  returning * into row_record;

  if found then
    perform public.record_follow_request_audit_event(
      row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'cancelled', '{}'::jsonb
    );
  end if;
end;
$$;

create or replace function public.approve_follow_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_record record;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.follow_requests
  set status = 'approved', updated_at = now(), resolved_at = now()
  where id = p_request_id
    and target_id = actor_id
    and status = 'pending'
  returning * into row_record;

  if not found then
    select * into row_record
    from public.follow_requests
    where id = p_request_id and target_id = actor_id and status = 'approved'
    limit 1;
    if not found then
      raise exception 'follow_request_not_pending';
    end if;
    if public.has_user_block_between(row_record.requester_id, row_record.target_id) then
      delete from public.follows
      where follower_id = row_record.requester_id and following_id = row_record.target_id;
      raise exception 'follow_blocked';
    end if;
    insert into public.follows (follower_id, following_id)
    values (row_record.requester_id, row_record.target_id)
    on conflict (follower_id, following_id) do nothing;
    return row_record.requester_id;
  end if;

  if public.has_user_block_between(row_record.requester_id, row_record.target_id) then
    update public.follow_requests
    set status = 'cancelled', updated_at = now(), resolved_at = now()
    where id = row_record.id;
    raise exception 'follow_blocked';
  end if;

  insert into public.follows (follower_id, following_id)
  values (row_record.requester_id, row_record.target_id)
  on conflict (follower_id, following_id) do nothing;

  perform public.record_follow_request_audit_event(
    row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'approved', '{}'::jsonb
  );

  return row_record.requester_id;
end;
$$;

create or replace function public.decline_follow_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_record record;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.follow_requests
  set status = 'declined', updated_at = now(), resolved_at = now()
  where id = p_request_id
    and target_id = actor_id
    and status = 'pending'
  returning * into row_record;

  if found then
    perform public.record_follow_request_audit_event(
      row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'declined', '{}'::jsonb
    );
    return row_record.requester_id;
  end if;

  select requester_id into row_record
  from public.follow_requests
  where id = p_request_id and target_id = actor_id
  limit 1;

  return row_record.requester_id;
end;
$$;

grant execute on function public.follow_relationship_state(uuid) to authenticated;
grant execute on function public.request_follow(uuid) to authenticated;
grant execute on function public.cancel_follow_request(uuid) to authenticated;
grant execute on function public.approve_follow_request(uuid) to authenticated;
grant execute on function public.decline_follow_request(uuid) to authenticated;

create or replace function public.profile_visibility_state(p_target_id uuid)
returns table (
  private_account boolean,
  can_view_content boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(us.private_account, false) as private_account,
    public.can_view_user_content(auth.uid(), u.id) as can_view_content
  from public.users u
  left join public.user_settings us on us.id = u.id
  where u.id = p_target_id
  limit 1;
$$;

grant execute on function public.profile_visibility_state(uuid) to authenticated, anon;

-- Block writes must atomically remove social access.
create or replace function public.block_user(p_blocked_id uuid, p_reason text default 'user_requested')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  request_row record;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_blocked_id is null or actor_id = p_blocked_id then
    raise exception 'invalid_block_target';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id, reason)
  values (actor_id, p_blocked_id, coalesce(p_reason, 'user_requested'))
  on conflict (blocker_id, blocked_id) do update
    set reason = excluded.reason, created_at = now();

  delete from public.follows
  where (follower_id = actor_id and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = actor_id);

  for request_row in
    update public.follow_requests
    set status = 'cancelled', updated_at = now(), resolved_at = now()
    where status = 'pending'
      and (
        (requester_id = actor_id and target_id = p_blocked_id)
        or (requester_id = p_blocked_id and target_id = actor_id)
      )
    returning *
  loop
    perform public.record_follow_request_audit_event(
      request_row.id,
      request_row.requester_id,
      request_row.target_id,
      actor_id,
      'blocked_cancelled',
      jsonb_build_object('blocker_id', actor_id)
    );
  end loop;
end;
$$;

grant execute on function public.block_user(uuid, text) to authenticated;

-- ─── privacy-aware RLS ──────────────────────────────────────────────────────

drop policy if exists "anyone can view posts" on public.posts;
create policy "Users can view permitted posts" on public.posts for select
  using (deleted_at is null and public.can_view_user_content(auth.uid(), user_id));

drop policy if exists "anyone can view post photos" on public.post_photos;
create policy "Users can view permitted post photos" on public.post_photos for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.deleted_at is null
        and public.can_view_user_content(auth.uid(), p.user_id)
    )
  );

drop policy if exists "anyone can view post hashtags" on public.post_hashtags;
create policy "Users can view permitted post hashtags" on public.post_hashtags for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.deleted_at is null
        and public.can_view_user_content(auth.uid(), p.user_id)
    )
  );

drop policy if exists "anyone can view comments" on public.comments;
create policy "Users can view permitted comments" on public.comments for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.deleted_at is null
        and public.can_view_user_content(auth.uid(), p.user_id)
    )
  );

drop policy if exists "users can view own collections" on public.collections;
create policy "Users can view permitted collections"
  on public.collections for select
  using (
    auth.uid() = user_id
    or (
      visibility in ('unlisted', 'public')
      and public.can_view_user_content(auth.uid(), user_id)
    )
  );

drop policy if exists "users can view own or shareable collection items" on public.collection_items;
create policy "Users can view permitted collection items"
  on public.collection_items for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (
          c.user_id = auth.uid()
          or (
            c.visibility in ('unlisted', 'public')
            and public.can_view_user_content(auth.uid(), c.user_id)
          )
        )
    )
  );

drop policy if exists "public_select_top_spots" on public.user_top_spots;
create policy "Users can view permitted top spots"
  on public.user_top_spots for select
  using (public.can_view_user_content(auth.uid(), user_id));

drop policy if exists "anyone authenticated can view post embeddings" on public.post_embeddings;
create policy "Users can view permitted post embeddings"
  on public.post_embeddings for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.deleted_at is null
        and public.can_view_user_content(auth.uid(), p.user_id)
    )
  );

-- ─── activity visibility ────────────────────────────────────────────────────

create or replace function public.set_activity_visibility(p_show boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.user_settings (id, show_activity_status, updated_at)
  values (actor_id, p_show, now())
  on conflict (id) do update
    set show_activity_status = excluded.show_activity_status,
        updated_at = excluded.updated_at;

  if not p_show then
    update public.users
    set last_seen_at = null, updated_at = now()
    where id = actor_id;
  end if;
end;
$$;

grant execute on function public.set_activity_visibility(boolean) to authenticated;

create or replace function public.visible_last_seen_at(p_user_ids uuid[])
returns table (user_id uuid, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id as user_id,
         case when coalesce(us.show_activity_status, true) then u.last_seen_at else null end as last_seen_at
  from public.users u
  left join public.user_settings us on us.id = u.id
  where u.id = any(p_user_ids);
$$;

grant execute on function public.visible_last_seen_at(uuid[]) to authenticated;

-- ─── search privacy filters ─────────────────────────────────────────────────

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
  with viewer as (select auth.uid() as id)
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
          'post_count',  (
            select count(*)
            from public.posts po, viewer v
            where po.dish_id = d.id
              and po.deleted_at is null
              and public.can_view_user_content(v.id, po.user_id)
          )
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
  v_viewer_id uuid := coalesce(p_user_id, auth.uid());
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
        join public.posts p on p.id = s.post_id
        where s.user_id = p_user_id
          and p.deleted_at is null
          and public.can_view_user_content(v_viewer_id, p.user_id)
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
    where public.can_view_user_content(v_viewer_id, po.user_id)
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
            and public.can_view_user_content(v_viewer_id, po2.user_id)
          order by po2.created_at desc
          limit 1
        ),
        'save_count', (select count(*) from public.saved_dishes sd2 where sd2.dish_id = d.id),
        'post_count', (
          select count(*)
          from public.posts po3
          where po3.dish_id = d.id
            and po3.deleted_at is null
            and public.can_view_user_content(v_viewer_id, po3.user_id)
        )
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

grant execute on function public.search_text_fallback(text, integer, double precision, double precision)
  to authenticated, anon;
grant execute on function public.search_text_fallback(text, integer)
  to authenticated, anon;
grant execute on function public.search_semantic(extensions.vector, uuid, integer, double precision, double precision)
  to authenticated, anon;
grant execute on function public.search_semantic(extensions.vector, uuid, integer)
  to authenticated, anon;

-- ─── audit view extension ───────────────────────────────────────────────────

create or replace view public.platform_audit_events_view as
  select id, 'auth_audit_events'::text as source_table,
    'auth'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.auth_audit_events
  union all
  select id, 'content_lifecycle_events'::text as source_table,
    entity_type, entity_id, user_id, event_type, context, created_at
  from public.content_lifecycle_events
  union all
  select id, 'dish_audit_events'::text as source_table,
    'dish'::text as entity_type, dish_id as entity_id,
    user_id, event_type, context, created_at
  from public.dish_audit_events
  union all
  select id, 'follow_request_audit_events'::text as source_table,
    'follow_request'::text as entity_type, follow_request_id as entity_id,
    actor_id as user_id, event_type, context, created_at
  from public.follow_request_audit_events
  union all
  select id, 'moderation_actions'::text as source_table,
    target_type as entity_type, target_id as entity_id,
    actor_id as user_id, action_type as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'reason', reason,
      'reversible', reversible, 'shadow_mode', shadow_mode, 'report_id', report_id
    )) || coalesce(metadata, '{}'::jsonb) as context,
    created_at
  from public.moderation_actions
  union all
  select id, 'post_edit_events'::text as source_table,
    'post'::text as entity_type, post_id as entity_id,
    user_id, event_type,
    jsonb_build_object('changed_fields', changed_fields, 'changed_field_count', changed_field_count) as context,
    created_at
  from public.post_edit_events
  union all
  select id, 'place_audit_events'::text as source_table,
    coalesce(entity_type, 'place')::text as entity_type,
    coalesce(entity_id, place_id) as entity_id,
    actor_id as user_id, action as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'source_type', source_type, 'reason', reason,
      'before_summary', before_summary, 'after_summary', after_summary,
      'compliance_category', compliance_category, 'place_id', place_id,
      'request_id', request_id, 'job_id', job_id, 'rollback_reference', rollback_reference
    )) as context,
    created_at
  from public.place_audit_events
  union all
  select id, 'user_profile_audit_events'::text as source_table,
    'user_profile'::text as entity_type, user_id as entity_id,
    user_id, event_type, context, created_at
  from public.user_profile_audit_events
  union all
  select id, 'collection_audit_events'::text as source_table,
    'collection'::text as entity_type, collection_id as entity_id,
    user_id, event_type, context, created_at
  from public.collection_audit_events
  union all
  select id, 'feature_flag_audit_events'::text as source_table,
    'feature_flag'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.feature_flag_audit_events
  union all
  select id, 'saved_search_audit_events'::text as source_table,
    'saved_search'::text as entity_type, saved_search_id as entity_id,
    user_id, event_type, context, created_at
  from public.saved_search_audit_events;
