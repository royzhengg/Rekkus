-- Support multiple pinned messages per conversation and a leave_group RPC.

-- ─── conversation_pinned_messages ────────────────────────────────────────────

create table if not exists public.conversation_pinned_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  message_id uuid references public.messages(id) on delete cascade not null,
  pinned_by uuid references public.users(id) on delete set null,
  pinned_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

alter table public.conversation_pinned_messages enable row level security;

create policy "Participants can view pinned messages"
  on public.conversation_pinned_messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_pinned_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can pin messages"
  on public.conversation_pinned_messages for insert
  with check (
    pinned_by = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_pinned_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Participants can unpin messages"
  on public.conversation_pinned_messages for delete
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_pinned_messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create index if not exists conversation_pinned_messages_conversation_idx
  on public.conversation_pinned_messages (conversation_id, pinned_at desc);

-- ─── leave_group RPC ─────────────────────────────────────────────────────────

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

revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- ─── update pin_message to use conversation_pinned_messages ──────────────────

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

drop function if exists public.unpin_message(uuid);
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

revoke all on function public.unpin_message(uuid) from public, anon;
grant execute on function public.unpin_message(uuid) to authenticated;
