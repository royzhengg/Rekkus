-- Fix infinite recursion in conversation_participants RLS policy.
--
-- Root cause: The original "Participants can view participants" policy on
-- conversation_participants queries the same table to check access, causing
-- PostgreSQL error 42P17. Because conversations, messages, and message_reactions
-- all have policies that filter through conversation_participants, ALL messaging
-- reads failed silently.
--
-- Fix: a SECURITY DEFINER helper function bypasses RLS when querying
-- conversation_participants, breaking the recursion. All affected policies
-- are replaced to use this helper.
--
-- Also drops the superseded 2-param send_direct_message overload left over from
-- 20240210, which caused PostgREST PGRST203 ambiguity errors.

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
  );
$$;

revoke all on function public.current_user_in_conversation(uuid) from public, anon;
grant execute on function public.current_user_in_conversation(uuid) to authenticated;

-- ─── conversation_participants ────────────────────────────────────────────────

drop policy if exists "Participants can view participants" on public.conversation_participants;
create policy "Participants can view participants"
  on public.conversation_participants for select
  using (current_user_in_conversation(conversation_id));

-- ─── conversations ────────────────────────────────────────────────────────────

drop policy if exists "Participants can view conversations" on public.conversations;
create policy "Participants can view conversations"
  on public.conversations for select
  using (current_user_in_conversation(id));

-- ─── messages ────────────────────────────────────────────────────────────────

drop policy if exists "Participants can view messages" on public.messages;
create policy "Participants can view messages"
  on public.messages for select
  using (current_user_in_conversation(conversation_id));

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and current_user_in_conversation(conversation_id)
  );

-- ─── message_reactions ───────────────────────────────────────────────────────

drop policy if exists "Participants can view reactions" on public.message_reactions;
create policy "Participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "Participants can react" on public.message_reactions;
create policy "Participants can react"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

-- ─── message_deliveries ──────────────────────────────────────────────────────

drop policy if exists "Participants can view deliveries" on public.message_deliveries;
create policy "Participants can view deliveries"
  on public.message_deliveries for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_deliveries.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

-- ─── conversation_pinned_messages ────────────────────────────────────────────

drop policy if exists "Participants can view pinned messages" on public.conversation_pinned_messages;
create policy "Participants can view pinned messages"
  on public.conversation_pinned_messages for select
  using (current_user_in_conversation(conversation_id));

drop policy if exists "Participants can pin messages" on public.conversation_pinned_messages;
create policy "Participants can pin messages"
  on public.conversation_pinned_messages for insert
  with check (
    pinned_by = auth.uid()
    and current_user_in_conversation(conversation_id)
  );

drop policy if exists "Participants can unpin messages" on public.conversation_pinned_messages;
create policy "Participants can unpin messages"
  on public.conversation_pinned_messages for delete
  using (current_user_in_conversation(conversation_id));

-- ─── Drop superseded 2-param RPC overload ────────────────────────────────────

drop function if exists public.send_direct_message(uuid, text);
