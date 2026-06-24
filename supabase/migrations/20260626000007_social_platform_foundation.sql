-- B-629: Social Platform Foundation.
-- Social events are the user-facing activity ledger. Relationship truth remains
-- in follows and follow_requests.

do $$ begin
  create type public.social_event_type as enum (
    'like_post',
    'comment_post',
    'reply_comment',
    'follow',
    'follow_request_pending',
    'follow_request_approved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.social_event_entity_type as enum (
    'post',
    'comment',
    'follow',
    'follow_request'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.social_event_source_type as enum (
    'like',
    'comment',
    'follow',
    'follow_request'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.follow_request_approval_source as enum ('manual', 'bulk', 'auto_public');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.privacy_audit_event_type as enum ('private_account_changed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_origin as enum ('user', 'system', 'migration', 'repair', 'admin');
exception when duplicate_object then null;
end $$;

alter table public.follows
  add constraint follows_no_self_follow check (follower_id <> following_id) not valid;

alter table public.follow_requests
  add column if not exists approval_source public.follow_request_approval_source,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users on delete set null,
  add column if not exists correlation_id uuid;

do $$ begin
  alter table public.follow_requests
    add constraint follow_requests_no_self_request check (requester_id <> target_id) not valid;
exception when duplicate_object then null;
end $$;

alter table public.follow_requests
  add constraint follow_requests_approved_source_required
    check (status <> 'approved' or approval_source is not null) not valid,
  add constraint follow_requests_terminal_resolved_at
    check (status = 'pending' or resolved_at is not null) not valid;

create unique index if not exists follow_requests_one_pending_idx
  on public.follow_requests (requester_id, target_id)
  where status = 'pending';

create table if not exists public.social_events (
  id             uuid default gen_random_uuid() primary key,
  actor_id       uuid references public.users on delete set null,
  target_user_id uuid references public.users on delete cascade not null,
  event_type     public.social_event_type not null,
  entity_type    public.social_event_entity_type not null,
  entity_id      uuid not null,
  source_type    public.social_event_source_type not null,
  source_id      uuid not null,
  origin         public.event_origin not null default 'user',
  correlation_id uuid not null default gen_random_uuid(),
  metadata       jsonb not null default '{}'::jsonb,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (source_type, source_id, event_type)
);

comment on table public.social_events is
  'Canonical user-facing activity ledger for Alerts. Relationship truth remains in follows/follow_requests.';
comment on column public.social_events.metadata is
  'Privacy-safe categorical metadata only; no usernames, captions, private text, place names, message bodies, or media URLs.';

create index if not exists social_events_target_created_idx
  on public.social_events (target_user_id, created_at desc, id desc);
create index if not exists social_events_target_type_created_idx
  on public.social_events (target_user_id, event_type, created_at desc, id desc);
create index if not exists social_events_actor_created_idx
  on public.social_events (actor_id, created_at desc, id desc);
create index if not exists social_events_source_idx
  on public.social_events (source_type, source_id, event_type);

alter table public.social_events enable row level security;

drop policy if exists "users can view their social events" on public.social_events;
create policy "Users can view their social events"
  on public.social_events for select
  using (target_user_id = auth.uid());

drop policy if exists "users can mark their social events read" on public.social_events;
create policy "Users can mark their social events read"
  on public.social_events for update
  using (target_user_id = auth.uid())
  with check (target_user_id = auth.uid());

drop policy if exists "no direct client social event writes" on public.social_events;
create policy "No direct client social event writes"
  on public.social_events for insert
  with check (false);

drop policy if exists "no direct client social event deletes" on public.social_events;
create policy "No direct client social event deletes"
  on public.social_events for delete
  using (false);

create or replace function public.enforce_social_event_read_state_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id is distinct from new.id
    or old.actor_id is distinct from new.actor_id
    or old.target_user_id is distinct from new.target_user_id
    or old.event_type is distinct from new.event_type
    or old.entity_type is distinct from new.entity_type
    or old.entity_id is distinct from new.entity_id
    or old.source_type is distinct from new.source_type
    or old.source_id is distinct from new.source_id
    or old.origin is distinct from new.origin
    or old.correlation_id is distinct from new.correlation_id
    or old.metadata is distinct from new.metadata
    or old.created_at is distinct from new.created_at
  then
    raise exception 'social_events_append_only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_social_events_read_state_only on public.social_events;
create trigger trg_social_events_read_state_only
  before update on public.social_events
  for each row execute function public.enforce_social_event_read_state_only();

create table if not exists public.notification_deliveries (
  id              uuid default gen_random_uuid() primary key,
  social_event_id uuid references public.social_events on delete cascade not null,
  recipient_id    uuid references public.users on delete cascade not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  attempt_count   integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error_code text,
  correlation_id  uuid not null,
  created_at      timestamptz not null default now(),
  unique (social_event_id, recipient_id)
);

comment on table public.notification_deliveries is
  'Operational push delivery state. User-visible activity lives in social_events.';

create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries (status, next_attempt_at, created_at);
create index if not exists notification_deliveries_recipient_idx
  on public.notification_deliveries (recipient_id, created_at desc);

alter table public.notification_deliveries enable row level security;

drop policy if exists "no direct client notification delivery access" on public.notification_deliveries;
create policy "No direct client notification delivery access"
  on public.notification_deliveries for all
  using (false)
  with check (false);

create table if not exists public.privacy_audit_events (
  id                    uuid default gen_random_uuid() primary key,
  user_id               uuid references public.users on delete set null,
  actor_id              uuid references public.users on delete set null,
  old_private_account   boolean,
  new_private_account   boolean not null,
  approved_request_count integer not null default 0,
  event_type            public.privacy_audit_event_type not null,
  origin                public.event_origin not null default 'user',
  correlation_id        uuid not null,
  context               jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

comment on table public.privacy_audit_events is
  'Append-only audit trail for privacy visibility transitions.';

create index if not exists privacy_audit_events_user_created_idx
  on public.privacy_audit_events (user_id, created_at desc);
create index if not exists privacy_audit_events_correlation_idx
  on public.privacy_audit_events (correlation_id);

alter table public.privacy_audit_events enable row level security;

drop policy if exists "no direct client privacy audit writes" on public.privacy_audit_events;
create policy "No direct client privacy audit writes"
  on public.privacy_audit_events for all
  using (false)
  with check (false);

create or replace function public.enqueue_social_event_delivery(p_social_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
  settings_row record;
  allowed boolean := true;
begin
  select * into event_row from public.social_events where id = p_social_event_id;
  if not found or event_row.target_user_id is null then
    return;
  end if;

  select notif_likes, notif_comments, notif_followers
  into settings_row
  from public.user_settings
  where id = event_row.target_user_id;

  allowed := case event_row.event_type
    when 'like_post' then coalesce(settings_row.notif_likes, true)
    when 'comment_post' then coalesce(settings_row.notif_comments, true)
    when 'reply_comment' then coalesce(settings_row.notif_comments, true)
    when 'follow' then coalesce(settings_row.notif_followers, true)
    when 'follow_request_pending' then coalesce(settings_row.notif_followers, true)
    when 'follow_request_approved' then coalesce(settings_row.notif_followers, true)
    else true
  end;

  if not allowed then
    return;
  end if;

  insert into public.notification_deliveries (
    social_event_id, recipient_id, status, next_attempt_at, correlation_id
  )
  values (
    event_row.id, event_row.target_user_id, 'pending', now(), event_row.correlation_id
  )
  on conflict (social_event_id, recipient_id) do nothing;
end;
$$;

create or replace function public.create_social_event(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_event_type public.social_event_type,
  p_entity_type public.social_event_entity_type,
  p_entity_id uuid,
  p_source_type public.social_event_source_type,
  p_source_id uuid,
  p_origin public.event_origin default 'user',
  p_correlation_id uuid default gen_random_uuid(),
  p_metadata jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  if p_target_user_id is null or p_entity_id is null or p_source_id is null then
    return null;
  end if;
  if p_actor_id is not null and p_actor_id = p_target_user_id then
    return null;
  end if;
  if p_actor_id is not null and public.has_user_block_between(p_actor_id, p_target_user_id) then
    return null;
  end if;

  insert into public.social_events (
    actor_id, target_user_id, event_type, entity_type, entity_id,
    source_type, source_id, origin, correlation_id, metadata, created_at
  )
  values (
    p_actor_id, p_target_user_id, p_event_type, p_entity_type, p_entity_id,
    p_source_type, p_source_id, p_origin, p_correlation_id,
    coalesce(p_metadata, '{}'::jsonb), coalesce(p_created_at, now())
  )
  on conflict (source_type, source_id, event_type) do update
    set read_at = public.social_events.read_at
  returning id into event_id;

  perform public.enqueue_social_event_delivery(event_id);
  return event_id;
end;
$$;

revoke all on function public.create_social_event(uuid, uuid, public.social_event_type, public.social_event_entity_type, uuid, public.social_event_source_type, uuid, public.event_origin, uuid, jsonb, timestamptz) from public;
revoke all on function public.enqueue_social_event_delivery(uuid) from public;

create or replace function public.trg_like_social_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  perform public.create_social_event(
    new.user_id, post_owner, 'like_post', 'post', new.post_id,
    'like', new.id, 'user', gen_random_uuid(), '{}'::jsonb, new.created_at
  );
  return new;
end;
$$;

drop trigger if exists trg_likes_social_event on public.likes;
create trigger trg_likes_social_event
  after insert on public.likes
  for each row execute function public.trg_like_social_event();

create or replace function public.trg_comment_social_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
  parent_owner uuid;
  target_id uuid;
  event_kind public.social_event_type;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select user_id into parent_owner from public.comments where id = new.parent_id;
    target_id := parent_owner;
    event_kind := 'reply_comment';
  else
    target_id := post_owner;
    event_kind := 'comment_post';
  end if;

  perform public.create_social_event(
    new.user_id, target_id, event_kind,
    case when new.parent_id is not null then 'comment'::public.social_event_entity_type else 'post'::public.social_event_entity_type end,
    coalesce(new.parent_id, new.post_id),
    'comment', new.id, 'user', gen_random_uuid(), '{}'::jsonb, new.created_at
  );
  return new;
end;
$$;

drop trigger if exists trg_comments_social_event on public.comments;
create trigger trg_comments_social_event
  after insert on public.comments
  for each row execute function public.trg_comment_social_event();

create or replace function public.trg_follow_social_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.follow_requests fr
    where fr.requester_id = new.follower_id
      and fr.target_id = new.following_id
      and fr.status = 'approved'
      and fr.resolved_at >= now() - interval '5 minutes'
  ) then
    return new;
  end if;

  perform public.create_social_event(
    new.follower_id, new.following_id, 'follow', 'follow', new.id,
    'follow', new.id, 'user', gen_random_uuid(), '{}'::jsonb, new.created_at
  );
  return new;
end;
$$;

drop trigger if exists trg_follows_social_event on public.follows;
create trigger trg_follows_social_event
  after insert on public.follows
  for each row execute function public.trg_follow_social_event();

create or replace function public.mark_all_social_events_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  changed_count integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.social_events
  set read_at = coalesce(read_at, now())
  where target_user_id = actor_id and read_at is null;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

grant execute on function public.mark_all_social_events_read() to authenticated;

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

  if public.has_user_block_between(actor_id, p_target_id) then
    return 'blocked';
  end if;

  if exists (
    select 1 from public.follows
    where follower_id = actor_id and following_id = p_target_id
  ) then
    return 'following';
  end if;

  if exists (
    select 1 from public.follow_requests
    where requester_id = p_target_id
      and target_id = actor_id
      and status = 'pending'
  ) then
    return 'incoming_request';
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
  target_follow_id uuid;
  correlation uuid := gen_random_uuid();
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

  if (
    select count(*)
    from public.follow_requests
    where requester_id = actor_id
      and created_at >= now() - interval '1 hour'
  ) >= 30 then
    raise exception 'follow_request_rate_limited';
  end if;

  if (
    select count(*)
    from public.follow_requests
    where requester_id = actor_id
      and created_at >= now() - interval '1 day'
  ) >= 200 then
    raise exception 'follow_request_rate_limited';
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
    on conflict (follower_id, following_id) do nothing
    returning id into target_follow_id;

    update public.follow_requests
    set status = 'cancelled', updated_at = now(), resolved_at = now(), correlation_id = correlation
    where requester_id = actor_id and target_id = p_target_id and status = 'pending';

    return 'following';
  end if;

  select id into request_id
  from public.follow_requests
  where requester_id = actor_id and target_id = p_target_id and status = 'pending'
  limit 1;

  if request_id is null then
    insert into public.follow_requests (requester_id, target_id, correlation_id)
    values (actor_id, p_target_id, correlation)
    returning id into request_id;

    perform public.record_follow_request_audit_event(
      request_id, actor_id, p_target_id, actor_id, 'requested',
      jsonb_build_object('correlation_id', correlation)
    );
  end if;

  perform public.create_social_event(
    actor_id, p_target_id, 'follow_request_pending', 'follow_request', request_id,
    'follow_request', request_id, 'user', correlation, '{}'::jsonb, now()
  );

  return 'requested';
end;
$$;

drop function if exists public.approve_follow_request(uuid);

create or replace function public.approve_follow_request(
  p_request_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
)
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
  set status = 'approved',
      approval_source = 'manual',
      updated_at = now(),
      resolved_at = now(),
      correlation_id = p_idempotency_key
  where id = p_request_id
    and target_id = actor_id
    and status = 'pending'
    and not public.has_user_block_between(requester_id, target_id)
  returning * into row_record;

  if not found then
    select * into row_record
    from public.follow_requests
    where id = p_request_id and target_id = actor_id and status = 'approved'
    limit 1;
    if not found then
      raise exception 'follow_request_not_pending';
    end if;
    return row_record.requester_id;
  end if;

  insert into public.follows (follower_id, following_id)
  values (row_record.requester_id, row_record.target_id)
  on conflict (follower_id, following_id) do nothing;

  perform public.create_social_event(
    actor_id, row_record.requester_id, 'follow_request_approved', 'follow_request', row_record.id,
    'follow_request', row_record.id, 'user', p_idempotency_key,
    jsonb_build_object('approval_source', 'manual'), now()
  );

  perform public.record_follow_request_audit_event(
    row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'approved',
    jsonb_build_object('approval_source', 'manual', 'correlation_id', p_idempotency_key)
  );

  return row_record.requester_id;
end;
$$;

drop function if exists public.decline_follow_request(uuid);

create or replace function public.decline_follow_request(
  p_request_id uuid,
  p_idempotency_key uuid default gen_random_uuid()
)
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
  set status = 'declined',
      deleted_at = now(),
      deleted_by = actor_id,
      updated_at = now(),
      resolved_at = now(),
      correlation_id = p_idempotency_key
  where id = p_request_id
    and target_id = actor_id
    and status = 'pending'
  returning * into row_record;

  if found then
    perform public.record_follow_request_audit_event(
      row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'declined',
      jsonb_build_object('correlation_id', p_idempotency_key)
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

create or replace function public.approve_all_follow_requests(
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_record record;
  requester_ids uuid[] := '{}';
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  for row_record in
    update public.follow_requests
    set status = 'approved',
        approval_source = 'bulk',
        updated_at = now(),
        resolved_at = now(),
        correlation_id = p_idempotency_key
    where target_id = actor_id
      and status = 'pending'
      and not public.has_user_block_between(requester_id, target_id)
    returning *
  loop
    insert into public.follows (follower_id, following_id)
    values (row_record.requester_id, row_record.target_id)
    on conflict (follower_id, following_id) do nothing;

    perform public.create_social_event(
      actor_id, row_record.requester_id, 'follow_request_approved', 'follow_request', row_record.id,
      'follow_request', row_record.id, 'user', p_idempotency_key,
      jsonb_build_object('approval_source', 'bulk'), now()
    );

    perform public.record_follow_request_audit_event(
      row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'approved',
      jsonb_build_object('approval_source', 'bulk', 'correlation_id', p_idempotency_key)
    );

    requester_ids := array_append(requester_ids, row_record.requester_id);
  end loop;

  return jsonb_build_object('approved_requester_ids', requester_ids, 'approved_count', coalesce(array_length(requester_ids, 1), 0));
end;
$$;

create or replace function public.decline_all_follow_requests(
  p_idempotency_key uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  row_record record;
  changed_count integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  for row_record in
    update public.follow_requests
    set status = 'declined',
        deleted_at = now(),
        deleted_by = actor_id,
        updated_at = now(),
        resolved_at = now(),
        correlation_id = p_idempotency_key
    where target_id = actor_id and status = 'pending'
    returning *
  loop
    perform public.record_follow_request_audit_event(
      row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'declined',
      jsonb_build_object('bulk', true, 'correlation_id', p_idempotency_key)
    );
    changed_count := changed_count + 1;
  end loop;

  return changed_count;
end;
$$;

create or replace function public.set_account_privacy(
  p_private boolean,
  p_idempotency_key uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_private boolean;
  row_record record;
  requester_ids uuid[] := '{}';
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(private_account, false)
  into previous_private
  from public.user_settings
  where id = actor_id
  for update;

  insert into public.user_settings (id, private_account, updated_at)
  values (actor_id, coalesce(p_private, false), now())
  on conflict (id) do update
    set private_account = excluded.private_account,
        updated_at = now();

  if coalesce(p_private, false) = false then
    for row_record in
      update public.follow_requests
      set status = 'approved',
          approval_source = 'auto_public',
          updated_at = now(),
          resolved_at = now(),
          correlation_id = p_idempotency_key
      where target_id = actor_id
        and status = 'pending'
        and not public.has_user_block_between(requester_id, target_id)
      returning *
    loop
      insert into public.follows (follower_id, following_id)
      values (row_record.requester_id, row_record.target_id)
      on conflict (follower_id, following_id) do nothing;

      perform public.create_social_event(
        actor_id, row_record.requester_id, 'follow_request_approved', 'follow_request', row_record.id,
        'follow_request', row_record.id, 'user', p_idempotency_key,
        jsonb_build_object('approval_source', 'auto_public'), now()
      );

      perform public.record_follow_request_audit_event(
        row_record.id, row_record.requester_id, row_record.target_id, actor_id, 'approved',
        jsonb_build_object('approval_source', 'auto_public', 'correlation_id', p_idempotency_key)
      );

      requester_ids := array_append(requester_ids, row_record.requester_id);
    end loop;
  end if;

  insert into public.privacy_audit_events (
    user_id, actor_id, old_private_account, new_private_account,
    approved_request_count, event_type, origin, correlation_id, context
  )
  values (
    actor_id, actor_id, coalesce(previous_private, false), coalesce(p_private, false),
    coalesce(array_length(requester_ids, 1), 0), 'private_account_changed',
    'user', p_idempotency_key, '{}'::jsonb
  );

  return jsonb_build_object(
    'private_account', coalesce(p_private, false),
    'approved_requester_ids', requester_ids,
    'approved_count', coalesce(array_length(requester_ids, 1), 0)
  );
end;
$$;

grant execute on function public.approve_follow_request(uuid, uuid) to authenticated;
grant execute on function public.decline_follow_request(uuid, uuid) to authenticated;
grant execute on function public.approve_all_follow_requests(uuid) to authenticated;
grant execute on function public.decline_all_follow_requests(uuid) to authenticated;
grant execute on function public.set_account_privacy(boolean, uuid) to authenticated;
grant execute on function public.follow_relationship_state(uuid) to authenticated;

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
  from public.saved_search_audit_events
  union all
  select id, 'follow_request_audit_events'::text as source_table,
    'follow_request'::text as entity_type, follow_request_id as entity_id,
    actor_id as user_id, event_type, context, created_at
  from public.follow_request_audit_events
  union all
  select id, 'privacy_audit_events'::text as source_table,
    'privacy_setting'::text as entity_type, user_id as entity_id,
    actor_id as user_id, event_type::text,
    jsonb_strip_nulls(jsonb_build_object(
      'old_private_account', old_private_account,
      'new_private_account', new_private_account,
      'approved_request_count', approved_request_count,
      'origin', origin,
      'correlation_id', correlation_id
    )) || coalesce(context, '{}'::jsonb) as context,
    created_at
  from public.privacy_audit_events;

-- 90-day idempotent visible-history backfill.
insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select l.user_id, p.user_id, 'like_post', 'post', p.id,
  'like', l.id, 'migration', gen_random_uuid(), '{}'::jsonb, l.created_at
from public.likes l
join public.posts p on p.id = l.post_id
where l.created_at >= now() - interval '90 days'
  and l.user_id <> p.user_id
on conflict (source_type, source_id, event_type) do nothing;

insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select c.user_id, p.user_id, 'comment_post', 'post', p.id,
  'comment', c.id, 'migration', gen_random_uuid(), '{}'::jsonb, c.created_at
from public.comments c
join public.posts p on p.id = c.post_id
where c.created_at >= now() - interval '90 days'
  and c.parent_id is null
  and c.user_id <> p.user_id
on conflict (source_type, source_id, event_type) do nothing;

insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select c.user_id, parent.user_id, 'reply_comment', 'comment', parent.id,
  'comment', c.id, 'migration', gen_random_uuid(), '{}'::jsonb, c.created_at
from public.comments c
join public.comments parent on parent.id = c.parent_id
where c.created_at >= now() - interval '90 days'
  and c.user_id <> parent.user_id
on conflict (source_type, source_id, event_type) do nothing;

insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select f.follower_id, f.following_id, 'follow', 'follow', f.id,
  'follow', f.id, 'migration', gen_random_uuid(), '{}'::jsonb, f.created_at
from public.follows f
where f.created_at >= now() - interval '90 days'
  and f.follower_id <> f.following_id
on conflict (source_type, source_id, event_type) do nothing;

insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select fr.requester_id, fr.target_id, 'follow_request_pending', 'follow_request', fr.id,
  'follow_request', fr.id, 'migration', coalesce(fr.correlation_id, gen_random_uuid()), '{}'::jsonb, fr.created_at
from public.follow_requests fr
where fr.status = 'pending'
  and fr.created_at >= now() - interval '90 days'
on conflict (source_type, source_id, event_type) do nothing;

insert into public.social_events (
  actor_id, target_user_id, event_type, entity_type, entity_id,
  source_type, source_id, origin, correlation_id, metadata, created_at
)
select fr.target_id, fr.requester_id, 'follow_request_approved', 'follow_request', fr.id,
  'follow_request', fr.id, 'migration', coalesce(fr.correlation_id, gen_random_uuid()),
  jsonb_build_object('approval_source', coalesce(fr.approval_source::text, 'manual')),
  coalesce(fr.resolved_at, fr.updated_at, fr.created_at)
from public.follow_requests fr
where fr.status = 'approved'
  and coalesce(fr.resolved_at, fr.updated_at, fr.created_at) >= now() - interval '90 days'
on conflict (source_type, source_id, event_type) do nothing;

insert into public.notification_deliveries (
  social_event_id, recipient_id, status, next_attempt_at, correlation_id, created_at
)
select se.id, se.target_user_id, 'pending', now(), se.correlation_id, se.created_at
from public.social_events se
where se.created_at >= now() - interval '90 days'
on conflict (social_event_id, recipient_id) do nothing;
