-- Domain: Functions / Messaging
-- Owner: Messaging
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- accept_message_request
create or replace function public.accept_message_request(p_conversation_id uuid)
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

  update public.conversation_participants
  set
    request_status = 'active',
    request_decided_at = now(),
    archived_at = null
  where conversation_id = p_conversation_id
    and user_id = actor_id
    and request_status = 'request';

  if not found then
    raise exception 'not_request';
  end if;

  update public.conversations c
  set status = 'active'
  where c.id = p_conversation_id
    and c.status = 'request'
    and not exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = c.id
        and cp.request_status = 'request'
    );
end;
$$;

-- create_group_conversation
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
  member_follows_creator boolean;
  member_request_status text;
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

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    is_admin,
    last_read_at,
    request_status
  )
  values (v_conversation_id, creator_id, true, now(), 'active');

  foreach v_member_id in array p_member_ids loop
    if v_member_id <> creator_id then
      select exists (
        select 1
        from public.follows
        where follower_id = v_member_id
          and following_id = creator_id
      ) into member_follows_creator;

      member_request_status := case when member_follows_creator then 'active' else 'request' end;

      insert into public.conversation_participants (
        conversation_id,
        user_id,
        is_admin,
        request_status,
        requested_by,
        requested_at
      )
      values (
        v_conversation_id,
        v_member_id,
        false,
        member_request_status,
        case when member_request_status = 'request' then creator_id else null end,
        case when member_request_status = 'request' then now() else null end
      )
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

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

-- current_user_in_conversation
create or replace function public.current_user_in_conversation(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and request_status <> 'declined'
  );
$$;

-- decline_message_request
create or replace function public.decline_message_request(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  conv_type text;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_type into conv_type
  from public.conversations
  where id = p_conversation_id;

  update public.conversation_participants
  set
    request_status = 'declined',
    request_decided_at = now(),
    archived_at = now()
  where conversation_id = p_conversation_id
    and user_id = actor_id
    and request_status = 'request';

  if not found then
    raise exception 'not_request';
  end if;

  if conv_type = 'direct' then
    update public.conversations
    set status = 'blocked'
    where id = p_conversation_id;
  end if;
end;
$$;

-- get_or_create_direct_conversation
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
  recipient_follows_sender boolean;
  target_request_status text;
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

  select exists (
    select 1
    from public.follows
    where follower_id = target_user_id
      and following_id = requester_id
  ) into recipient_follows_sender;

  target_request_status := case when recipient_follows_sender then 'active' else 'request' end;
  initial_status := case when target_request_status = 'active' then 'active' else 'request' end;

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

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    last_read_at,
    request_status
  )
  values (existing_conversation_id, requester_id, now(), 'active')
  on conflict (conversation_id, user_id) do update
    set request_status = case
      when conversation_participants.request_status = 'declined' then 'declined'
      else conversation_participants.request_status
    end;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    request_status,
    requested_by,
    requested_at
  )
  values (
    existing_conversation_id,
    target_user_id,
    target_request_status,
    case when target_request_status = 'request' then requester_id else null end,
    case when target_request_status = 'request' then now() else null end
  )
  on conflict (conversation_id, user_id) do update
    set
      request_status = case
        when conversation_participants.request_status in ('active', 'declined')
          then conversation_participants.request_status
        else excluded.request_status
      end,
      requested_by = case
        when conversation_participants.request_status = 'request' then excluded.requested_by
        else conversation_participants.requested_by
      end,
      requested_at = case
        when conversation_participants.request_status = 'request' then excluded.requested_at
        else conversation_participants.requested_at
      end;

  return existing_conversation_id;
end;
$$;

-- leave_group
create or replace function public.leave_group(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  conv_type text;
  admin_count int;
  member_count int;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select conversation_type into conv_type
  from public.conversations
  where id = p_conversation_id;

  if conv_type <> 'group' then
    raise exception 'not_a_group';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  -- Remove the leaving member
  delete from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = actor_id;

  -- Count remaining members
  select count(*) into member_count
  from public.conversation_participants
  where conversation_id = p_conversation_id;

  if member_count = 0 then
    -- Last member left — archive the conversation
    update public.conversations
    set status = 'archived'
    where id = p_conversation_id;
    return;
  end if;

  -- If no admins remain, auto-promote the longest-standing member
  select count(*) into admin_count
  from public.conversation_participants
  where conversation_id = p_conversation_id and is_admin = true;

  if admin_count = 0 then
    update public.conversation_participants
    set is_admin = true
    where conversation_id = p_conversation_id
      and user_id = (
        select user_id from public.conversation_participants
        where conversation_id = p_conversation_id
        order by created_at asc
        limit 1
      );
  end if;

  -- Post system message
  insert into public.messages (conversation_id, sender_id, message_type, attachment_metadata)
  values (
    p_conversation_id,
    actor_id,
    'system',
    jsonb_build_object('event', 'member_left', 'actor', actor_id)
  );
end;
$$;

-- pin_message
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

  insert into public.conversation_pinned_messages (conversation_id, message_id, pinned_by)
  values (v_conversation_id, p_message_id, actor_id)
  on conflict (conversation_id, message_id) do nothing;
end;
$$;

-- send_direct_message
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
  conv_type text;
begin
  if sender_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_message_type not in ('text', 'image', 'video', 'audio', 'gif', 'sticker', 'file', 'location', 'post_share', 'place_share') then
    raise exception 'invalid_message_type';
  end if;

  if p_message_type = 'text' and (char_length(clean_body) < 1 or char_length(clean_body) > 2000) then
    raise exception 'invalid_message';
  end if;

  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = sender_id
      and request_status = 'active'
  ) then
    raise exception 'not_participant';
  end if;

  select status, conversation_type into conv_status, conv_type
  from public.conversations
  where id = p_conversation_id;

  if conv_status = 'blocked' then
    raise exception 'messaging_blocked';
  end if;

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

  if conv_type = 'direct' and exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id <> sender_id
      and request_status = 'declined'
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
  set updated_at = inserted_message.created_at
  where id = p_conversation_id;

  return inserted_message;
end;
$$;

-- unpin_message
create or replace function public.unpin_message(p_message_id uuid)
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
  where id = p_message_id;

  if v_conversation_id is null then
    raise exception 'message_not_found';
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = v_conversation_id and user_id = actor_id
  ) then
    raise exception 'not_participant';
  end if;

  delete from public.conversation_pinned_messages
  where conversation_id = v_conversation_id
    and message_id = p_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- MESSAGING TRIGGERS
-- ---------------------------------------------------------------------------

-- (No messaging-specific triggers in current schema.sql; triggers are in functions/auth.sql and functions/stats.sql)
