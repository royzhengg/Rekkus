-- Mention notification pipeline (phases B–E).
-- Enum additions are in 20260626000011_mention_enums.sql (must run first, separate transaction).
-- See: docs/social/mentions.md, docs/social/notifications.md, docs/adr/ADR-0032

-- ─────────────────────────────────────────────
-- Phase B: Indexes
-- ─────────────────────────────────────────────

-- Partial unique index for mention events.
-- The existing (source_type, source_id, event_type) constraint is insufficient for mentions
-- because multiple recipients on the same entity share the same source_id.
-- This index enforces: one mention notification per (actor, recipient, entity_type, entity_id).
-- See ADR-0032 for rationale.
create unique index if not exists social_events_mention_unique_idx
  on public.social_events (actor_id, target_user_id, entity_type, entity_id)
  where event_type = 'mention';

-- Index to support efficient batch username lookups in resolve_mention_user_ids().
-- Invariant: lower(username) must be unique across all users (enforced by users table schema).
create index if not exists users_username_lower_idx
  on public.users (lower(username));

-- ─────────────────────────────────────────────
-- Phase C: SQL helper functions
-- ─────────────────────────────────────────────

-- parse_mention_usernames(text) → text[]
-- Pure: no DB access. Extracts, lowercases, deduplicates, caps at 20.
-- Regex: '(?:^|[^[:alnum:]])@([[:alnum:]_]+)' using POSIX ERE (no lookbehind in PostgreSQL).
-- Constants mirror lib/social/mentions.ts — see docs/social/mentions.md.
create or replace function public.parse_mention_usernames(p_text text)
returns text[]
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  truncated    text;
  matches      text[];
  username     text;
  unique_set   text[] := '{}';
  mention_count integer := 0;
begin
  if p_text is null or p_text = '' then
    return '{}';
  end if;

  truncated := substring(p_text, 1, 10000);

  for matches in
    select regexp_matches(truncated, '(?:^|[^[:alnum:]])@([[:alnum:]_]+)', 'g')
  loop
    username := lower(matches[1]);
    if username = any(unique_set) then
      continue;
    end if;
    if mention_count >= 20 then
      raise log 'parse_mention_usernames: mention_limit_hit, input has >20 unique mentions';
      exit;
    end if;
    unique_set    := array_append(unique_set, username);
    mention_count := mention_count + 1;
  end loop;

  return unique_set;
end;
$$;

revoke all on function public.parse_mention_usernames(text) from public;
grant execute on function public.parse_mention_usernames(text) to service_role;


-- resolve_mention_user_ids(usernames, actor_id, entity_type, entity_id) → TABLE(user_id)
-- Read-only. Single batch query — no per-username round-trips.
-- Filters: no self-mention, allow_tags respected, blocks respected.
-- Idempotency is handled downstream by ON CONFLICT DO NOTHING on social_events_mention_unique_idx.
create or replace function public.resolve_mention_user_ids(
  p_usernames   text[],
  p_actor_id    uuid,
  p_entity_type public.social_event_entity_type,
  p_entity_id   uuid
)
returns table(user_id uuid)
language sql
security definer
set search_path = public
as $$
  select u.id
  from   public.users u
  join   public.user_settings us on us.id = u.id
  where  lower(u.username) = any(p_usernames)          -- uses users_username_lower_idx
    and  u.id <> p_actor_id                            -- no self-mention
    and  coalesce(us.allow_tags, true) = true          -- respects allow_tags setting
    and  not public.has_user_block_between(p_actor_id, u.id)  -- respects block relationships
$$;

revoke all on function public.resolve_mention_user_ids(text[], uuid, public.social_event_entity_type, uuid) from public;
grant execute on function public.resolve_mention_user_ids(text[], uuid, public.social_event_entity_type, uuid) to service_role;


-- create_mention_events(actor_id, entity_type, entity_id, source_id, resolved_ids) → void
-- Write-only. Accepts already-resolved IDs only.
-- Must never: resolve usernames, inspect captions, query user_settings.
-- Each recipient is independent — one failure does not prevent others.
create or replace function public.create_mention_events(
  p_actor_id    uuid,
  p_entity_type public.social_event_entity_type,
  p_entity_id   uuid,
  p_source_id   uuid,
  p_resolved_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if p_resolved_ids is null or cardinality(p_resolved_ids) = 0 then
    return;
  end if;

  foreach target_id in array p_resolved_ids loop
    perform public.create_social_event(
      p_actor_id,
      target_id,
      'mention'::public.social_event_type,
      p_entity_type,
      p_entity_id,
      'mention'::public.social_event_source_type,
      p_source_id
    );
  end loop;
end;
$$;

revoke all on function public.create_mention_events(uuid, public.social_event_entity_type, uuid, uuid, uuid[]) from public;
grant execute on function public.create_mention_events(uuid, public.social_event_entity_type, uuid, uuid, uuid[]) to service_role;


-- ─────────────────────────────────────────────
-- Phase D: Trigger functions
-- ─────────────────────────────────────────────

-- extract_post_mentions() — fires after INSERT or UPDATE OF caption on posts.
-- On UPDATE: only processes newly added @mentions (set difference), never re-notifies.
-- Failure: logs and swallows — never blocks post creation.
create or replace function public.extract_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_usernames text[];
  old_usernames text[];
  added_usernames text[];
  resolved_ids  uuid[];
begin
  -- Early exit: caption unchanged on UPDATE
  if tg_op = 'UPDATE' and new.caption is not distinct from old.caption then
    return new;
  end if;

  new_usernames := public.parse_mention_usernames(new.caption);

  if new_usernames is null or cardinality(new_usernames) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_usernames := public.parse_mention_usernames(old.caption);
    -- Only newly added usernames (set difference: new - old)
    select array_agg(u)
    into   added_usernames
    from   unnest(new_usernames) u
    where  u <> all(coalesce(old_usernames, '{}'));
  else
    added_usernames := new_usernames;
  end if;

  if added_usernames is null or cardinality(added_usernames) = 0 then
    return new;
  end if;

  select array_agg(r.user_id)
  into   resolved_ids
  from   public.resolve_mention_user_ids(added_usernames, new.user_id, 'post', new.id) r;

  if resolved_ids is not null and cardinality(resolved_ids) > 0 then
    perform public.create_mention_events(new.user_id, 'post', new.id, new.id, resolved_ids);
  end if;

  return new;
exception when others then
  raise log 'extract_post_mentions failed on post %: %, %', new.id, sqlstate, sqlerrm;
  return new;
end;
$$;

revoke all on function public.extract_post_mentions() from public;
grant execute on function public.extract_post_mentions() to service_role;

drop trigger if exists mention_social_event on public.posts;
create trigger mention_social_event
  after insert or update of caption on public.posts
  for each row
  execute function public.extract_post_mentions();


-- extract_comment_mentions() — fires after INSERT or UPDATE OF content on comments.
-- Identical logic to extract_post_mentions() but for comment.content and entity_type = 'comment'.
create or replace function public.extract_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_usernames   text[];
  old_usernames   text[];
  added_usernames text[];
  resolved_ids    uuid[];
begin
  -- Early exit: content unchanged on UPDATE
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
    return new;
  end if;

  new_usernames := public.parse_mention_usernames(new.content);

  if new_usernames is null or cardinality(new_usernames) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_usernames := public.parse_mention_usernames(old.content);
    select array_agg(u)
    into   added_usernames
    from   unnest(new_usernames) u
    where  u <> all(coalesce(old_usernames, '{}'));
  else
    added_usernames := new_usernames;
  end if;

  if added_usernames is null or cardinality(added_usernames) = 0 then
    return new;
  end if;

  select array_agg(r.user_id)
  into   resolved_ids
  from   public.resolve_mention_user_ids(added_usernames, new.user_id, 'comment', new.id) r;

  if resolved_ids is not null and cardinality(resolved_ids) > 0 then
    perform public.create_mention_events(new.user_id, 'comment', new.id, new.id, resolved_ids);
  end if;

  return new;
exception when others then
  raise log 'extract_comment_mentions failed on comment %: %, %', new.id, sqlstate, sqlerrm;
  return new;
end;
$$;

revoke all on function public.extract_comment_mentions() from public;
grant execute on function public.extract_comment_mentions() to service_role;

drop trigger if exists mention_social_event on public.comments;
create trigger mention_social_event
  after insert or update of content on public.comments
  for each row
  execute function public.extract_comment_mentions();


-- ─────────────────────────────────────────────
-- Phase E: Update enqueue_social_event_delivery + pg_net
-- ─────────────────────────────────────────────

-- Seed the global kill-switch config entry (enabled by default).
insert into public.app_config (key, value)
values ('mention_notifications_enabled', 'true')
on conflict (key) do nothing;

-- Replace enqueue_social_event_delivery to:
--   1. Gate mention events on notif_mentions.
--   2. After inserting notification_deliveries, fire send-push via pg_net for mention events.
-- Note: the AFTER INSERT trigger runs synchronously inside the transaction.
-- The pg_net HTTP request is queued here but sent after the transaction commits.
-- Post/comment creation is never blocked by the HTTP call.
create or replace function public.enqueue_social_event_delivery(p_social_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  event_row    record;
  settings_row record;
  allowed      boolean := true;
  v_url        text;
  v_key        text;
  v_enabled    text;
begin
  select * into event_row from public.social_events where id = p_social_event_id;
  if not found or event_row.target_user_id is null then
    return;
  end if;

  select notif_likes, notif_comments, notif_followers, notif_mentions, notif_messages
  into settings_row
  from public.user_settings
  where id = event_row.target_user_id;

  allowed := case event_row.event_type
    when 'like_post'               then coalesce(settings_row.notif_likes,    true)
    when 'comment_post'            then coalesce(settings_row.notif_comments,  true)
    when 'reply_comment'           then coalesce(settings_row.notif_comments,  true)
    when 'follow'                  then coalesce(settings_row.notif_followers, true)
    when 'follow_request_pending'  then coalesce(settings_row.notif_followers, true)
    when 'follow_request_approved' then coalesce(settings_row.notif_followers, true)
    when 'mention'                 then coalesce(settings_row.notif_mentions,  true)
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

  -- Fire push notification for mention events via pg_net (async, fires after commit).
  if event_row.event_type = 'mention' then
    select value into v_url     from public.app_config where key = 'supabase_url';
    select value into v_key     from public.app_config where key = 'service_role_key';
    select value into v_enabled from public.app_config where key = 'mention_notifications_enabled';

    if v_url is not null and v_key is not null and v_enabled = 'true' then
      perform extensions.net.http_post(
        url     := v_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body    := jsonb_build_object(
          'type',            'mention',
          'actorId',         event_row.actor_id::text,
          'mentionedUserId', event_row.target_user_id::text,
          'entityId',        event_row.entity_id::text,
          'entityType',      event_row.entity_type::text,
          'notificationId',  event_row.id::text
        )
      );
    end if;
  end if;
end;
$$;

revoke all on function public.enqueue_social_event_delivery(uuid) from public;
grant execute on function public.enqueue_social_event_delivery(uuid) to service_role;
