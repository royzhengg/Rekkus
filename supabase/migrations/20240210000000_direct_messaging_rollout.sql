-- Direct messaging rollout hardening.

alter table public.user_settings
  add column if not exists notif_messages boolean not null default true;

alter table public.conversations
  add column if not exists direct_user_low uuid references public.users on delete cascade,
  add column if not exists direct_user_high uuid references public.users on delete cascade;

alter table public.conversations
  add constraint conversations_direct_pair_check
  check (
    conversation_type <> 'direct'
    or direct_user_low is null
    or direct_user_high is null
    or direct_user_low <> direct_user_high
  );

create unique index if not exists conversations_direct_pair_unique_idx
  on public.conversations (direct_user_low, direct_user_high)
  where conversation_type = 'direct'
    and direct_user_low is not null
    and direct_user_high is not null;

create index if not exists conversation_participants_conversation_user_idx
  on public.conversation_participants (conversation_id, user_id);

create index if not exists messages_unread_idx
  on public.messages (conversation_id, created_at, sender_id)
  where deleted_at is null;

drop policy if exists "Participants can send messages" on public.messages;

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
      direct_user_high
    )
    values (
      requester_id,
      'direct',
      low_user_id,
      high_user_id
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

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text
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
begin
  if sender_id is null then
    raise exception 'not_authenticated';
  end if;

  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'invalid_message';
  end if;

  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = sender_id
  ) then
    raise exception 'not_participant';
  end if;

  select user_id
    into recipient_id
  from public.conversation_participants
  where conversation_id = p_conversation_id
    and user_id <> sender_id
  limit 1;

  if recipient_id is null then
    raise exception 'missing_recipient';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where (blocker_id = sender_id and blocked_id = recipient_id)
       or (blocker_id = recipient_id and blocked_id = sender_id)
  ) then
    raise exception 'messaging_blocked';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, sender_id, clean_body)
  returning * into inserted_message;

  update public.conversations
    set updated_at = inserted_message.created_at
  where id = p_conversation_id;

  return inserted_message;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke all on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
