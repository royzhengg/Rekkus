-- Rich messaging: message types, reactions, group chats, message requests,
-- conversation management, online status, pinned messages, and per-message read receipts.

-- ─── messages: add rich content columns ────────────────────────────────────────

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists attachment_url text,
  add column if not exists attachment_metadata jsonb,
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

-- Extend message_type to all supported types (including 'system' for group events)
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'audio', 'gif', 'sticker', 'file', 'location', 'post_share', 'place_share', 'system'));

-- body is now optional for non-text types (image caption, etc.)
alter table public.messages alter column body drop not null;

-- Drop inline body check and replace with type-aware constraint
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check check (
    (message_type = 'text' and body is not null and char_length(body) between 1 and 2000)
    or (message_type <> 'text' and (body is null or char_length(body) <= 500))
  );

-- ─── message_reactions ─────────────────────────────────────────────────────────

create table if not exists public.message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "Participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cp.user_id = auth.uid()
    )
  );

create policy "Participants can react"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can remove own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

-- ─── message_deliveries (per-message read receipts) ───────────────────────────

create table if not exists public.message_deliveries (
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

alter table public.message_deliveries enable row level security;

create policy "Participants can view deliveries"
  on public.message_deliveries for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_deliveries.message_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can upsert own delivery record"
  on public.message_deliveries for insert
  with check (user_id = auth.uid());

create policy "Users can update own delivery record"
  on public.message_deliveries for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── conversations: group support, status, pinned message ──────────────────────

-- Drop existing inline type check and replace with group-aware version
alter table public.conversations drop constraint if exists conversations_conversation_type_check;
alter table public.conversations
  add constraint conversations_conversation_type_check
  check (conversation_type in ('direct', 'group'));

alter table public.conversations
  add column if not exists status text not null default 'active',
  add column if not exists name text,
  add column if not exists avatar_url text,
  add column if not exists pinned_message_id uuid references public.messages(id) on delete set null;

alter table public.conversations
  add constraint conversations_status_check
  check (status in ('active', 'request', 'blocked', 'muted', 'archived'));

-- ─── conversation_participants: per-user inbox state + admin role ──────────────

alter table public.conversation_participants
  add column if not exists muted_until timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists is_admin boolean not null default false;

-- ─── users: online/active status ───────────────────────────────────────────────

alter table public.users
  add column if not exists last_seen_at timestamptz;

-- ─── user_settings: activity status privacy ────────────────────────────────────

alter table public.user_settings
  add column if not exists show_activity_status boolean not null default true;

-- ─── indexes ───────────────────────────────────────────────────────────────────

create index if not exists messages_reply_to_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

create index if not exists messages_type_idx
  on public.messages (conversation_id, message_type)
  where deleted_at is null;

create index if not exists conversation_participants_pinned_idx
  on public.conversation_participants (user_id, pinned_at desc)
  where pinned_at is not null;

create index if not exists users_last_seen_idx
  on public.users (last_seen_at desc)
  where last_seen_at is not null;

-- ─── delete_message RPC (true erasure) ────────────────────────────────────────

create or replace function public.delete_message(p_message_id uuid)
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

  update public.messages
  set
    deleted_at = now(),
    body = null,
    attachment_url = null,
    attachment_metadata = null
  where id = p_message_id
    and sender_id = actor_id
    and deleted_at is null;
end;
$$;

-- ─── pin_message / unpin_message RPCs ─────────────────────────────────────────

create or replace function public.pin_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_id into v_conversation_id
  from public.messages
  where id = p_message_id and deleted_at is null;

  if v_conversation_id is null then
    raise exception 'message_not_found';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = v_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  update public.conversations
  set pinned_message_id = p_message_id
  where id = v_conversation_id;
end;
$$;

create or replace function public.unpin_message(p_conversation_id uuid)
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

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  update public.conversations
  set pinned_message_id = null
  where id = p_conversation_id;
end;
$$;

-- ─── create_group_conversation RPC ────────────────────────────────────────────

create or replace function public.create_group_conversation(
  p_name text,
  p_member_ids uuid[],
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  creator_id uuid := auth.uid();
  v_conversation_id uuid;
  v_member_id uuid;
  v_clean_name text := btrim(coalesce(p_name, ''));
begin
  if creator_id is null then
    raise exception 'not_authenticated';
  end if;

  if char_length(v_clean_name) < 1 or char_length(v_clean_name) > 100 then
    raise exception 'invalid_group_name';
  end if;

  if array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) < 2 then
    raise exception 'insufficient_members';
  end if;

  insert into public.conversations (created_by, conversation_type, name, avatar_url, status)
  values (creator_id, 'group', v_clean_name, p_avatar_url, 'active')
  returning id into v_conversation_id;

  -- Enrol creator as admin
  insert into public.conversation_participants (conversation_id, user_id, is_admin, last_read_at)
  values (v_conversation_id, creator_id, true, now());

  -- Enrol all members
  foreach v_member_id in array p_member_ids loop
    if v_member_id <> creator_id then
      insert into public.conversation_participants (conversation_id, user_id, is_admin)
      values (v_conversation_id, v_member_id, false)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  -- Post system message
  insert into public.messages (conversation_id, sender_id, message_type, attachment_metadata)
  values (
    v_conversation_id,
    creator_id,
    'system',
    jsonb_build_object('event', 'group_created', 'actor', creator_id, 'name', v_clean_name)
  );

  return v_conversation_id;
end;
$$;

-- ─── update get_or_create_direct_conversation: message request gating ─────────

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  low_user_id uuid;
  high_user_id uuid;
  existing_conversation_id uuid;
  is_follower boolean;
  initial_status text;
begin
  if requester_id is null then
    raise exception 'not_authenticated';
  end if;

  if target_user_id is null or target_user_id = requester_id then
    raise exception 'invalid_target';
  end if;

  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'target_not_found';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where (blocker_id = requester_id and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = requester_id)
  ) then
    raise exception 'messaging_blocked';
  end if;

  -- Determine if requester follows target (message request vs active)
  select exists (
    select 1 from public.follows
    where follower_id = requester_id and following_id = target_user_id
  ) into is_follower;

  initial_status := case when is_follower then 'active' else 'request' end;

  if requester_id::text < target_user_id::text then
    low_user_id := requester_id;
    high_user_id := target_user_id;
  else
    low_user_id := target_user_id;
    high_user_id := requester_id;
  end if;

  select id
    into existing_conversation_id
  from public.conversations
  where conversation_type = 'direct'
    and direct_user_low = low_user_id
    and direct_user_high = high_user_id
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (
      created_by,
      conversation_type,
      direct_user_low,
      direct_user_high,
      status
    )
    values (
      requester_id,
      'direct',
      low_user_id,
      high_user_id,
      initial_status
    )
    on conflict (direct_user_low, direct_user_high)
      where conversation_type = 'direct'
        and direct_user_low is not null
        and direct_user_high is not null
      do update set updated_at = public.conversations.updated_at
    returning id into existing_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (existing_conversation_id, requester_id, now())
  on conflict (conversation_id, user_id) do nothing;

  insert into public.conversation_participants (conversation_id, user_id)
  values (existing_conversation_id, target_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return existing_conversation_id;
end;
$$;

-- ─── update send_direct_message: rich types, status check ─────────────────────

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text default null,
  p_message_type text default 'text',
  p_attachment_url text default null,
  p_attachment_metadata jsonb default null,
  p_reply_to_message_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid := auth.uid();
  recipient_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
  inserted_message public.messages;
  conv_status text;
begin
  if sender_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Validate message type
  if p_message_type not in ('text', 'image', 'video', 'audio', 'gif', 'sticker', 'file', 'location', 'post_share', 'place_share') then
    raise exception 'invalid_message_type';
  end if;

  -- Validate body for text messages
  if p_message_type = 'text' and (char_length(clean_body) < 1 or char_length(clean_body) > 2000) then
    raise exception 'invalid_message';
  end if;

  -- Check sender is participant
  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = sender_id
  ) then
    raise exception 'not_participant';
  end if;

  -- Check conversation is not blocked
  select status into conv_status
  from public.conversations
  where id = p_conversation_id;

  if conv_status = 'blocked' then
    raise exception 'messaging_blocked';
  end if;

  -- Get recipient (for 1:1 block check)
  select user_id
    into recipient_id
  from public.conversation_participants
  where conversation_id = p_conversation_id
    and user_id <> sender_id
  limit 1;

  if recipient_id is not null and exists (
    select 1
    from public.user_blocks
    where (blocker_id = sender_id and blocked_id = recipient_id)
       or (blocker_id = recipient_id and blocked_id = sender_id)
  ) then
    raise exception 'messaging_blocked';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    message_type,
    attachment_url,
    attachment_metadata,
    reply_to_message_id
  )
  values (
    p_conversation_id,
    sender_id,
    nullif(clean_body, ''),
    p_message_type,
    p_attachment_url,
    p_attachment_metadata,
    p_reply_to_message_id
  )
  returning * into inserted_message;

  update public.conversations
    set updated_at = inserted_message.created_at,
        -- Auto-promote request to active when recipient replies
        status = case
          when status = 'request' and sender_id <> (
            select cp.user_id from public.conversation_participants cp
            where cp.conversation_id = p_conversation_id
              and cp.user_id <> sender_id
            limit 1
          ) then 'active'
          else status
        end
  where id = p_conversation_id;

  return inserted_message;
end;
$$;

-- Grant execute permissions
revoke all on function public.delete_message(uuid) from public, anon;
revoke all on function public.pin_message(uuid) from public, anon;
revoke all on function public.unpin_message(uuid) from public, anon;
revoke all on function public.create_group_conversation(text, uuid[], text) from public, anon;

grant execute on function public.delete_message(uuid) to authenticated;
grant execute on function public.pin_message(uuid) to authenticated;
grant execute on function public.unpin_message(uuid) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[], text) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text, text, text, jsonb, uuid) to authenticated;
