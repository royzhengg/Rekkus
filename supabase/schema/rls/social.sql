-- Domain: RLS / Social
-- Owner: Platform
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.saved_places enable row level security;
alter table public.push_tokens enable row level security;
alter table public.user_top_spots enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.place_stubs enable row level security;

-- ---------------------------------------------------------------------------
-- public.follows
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select using (true);

drop policy if exists "users can manage their own follows" on public.follows;
create policy "Users can manage their own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);


-- ---------------------------------------------------------------------------
-- public.collections + collection_items
-- ---------------------------------------------------------------------------

drop policy if exists "users can view own collections" on public.collections;
create policy "Users can view own collections"
  on public.collections for select
  using (auth.uid() = user_id or visibility in ('unlisted', 'public'));

drop policy if exists "users manage own collections" on public.collections;
create policy "Users manage own collections"
  on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can view own or shareable collection items" on public.collection_items;
create policy "Users can view own or shareable collection items"
  on public.collection_items for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and (c.user_id = auth.uid() or c.visibility in ('unlisted', 'public'))
    )
  );

drop policy if exists "users manage own collection items" on public.collection_items;
create policy "Users manage own collection items"
  on public.collection_items for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and c.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- public.saved_places
-- ---------------------------------------------------------------------------

drop policy if exists "users manage own saved places" on public.saved_places;
create policy "Users manage own saved places"
  on public.saved_places for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------

drop policy if exists "users manage own tokens" on push_tokens;
create policy "Users manage own tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- public.user_top_spots
-- ---------------------------------------------------------------------------

drop policy if exists "public_select_top_spots" on public.user_top_spots;
CREATE POLICY "public_select_top_spots"
  ON public.user_top_spots FOR SELECT USING (true);

drop policy if exists "users_delete_top_spots" on public.user_top_spots;
CREATE POLICY "users_delete_top_spots"
  ON public.user_top_spots FOR DELETE USING (auth.uid() = user_id);

drop policy if exists "users_insert_top_spots" on public.user_top_spots;
CREATE POLICY "users_insert_top_spots"
  ON public.user_top_spots FOR INSERT WITH CHECK (auth.uid() = user_id);

drop policy if exists "users_update_top_spots" on public.user_top_spots;
CREATE POLICY "users_update_top_spots"
  ON public.user_top_spots FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

-- public.conversations
drop policy if exists "participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update
  using (current_user_in_conversation(id))
  with check (current_user_in_conversation(id));

drop policy if exists "participants can view conversations" on public.conversations;
create policy "Participants can view conversations"
  on public.conversations for select
  using (current_user_in_conversation(id));

drop policy if exists "users can create conversations" on public.conversations;
create policy "Users can create conversations"
  on public.conversations for insert
  with check (created_by = auth.uid());


-- public.conversation_participants
drop policy if exists "participants can view participants" on public.conversation_participants;
create policy "Participants can view participants"
  on public.conversation_participants for select
  using (current_user_in_conversation(conversation_id));

drop policy if exists "users can join conversations created for them" on public.conversation_participants;
create policy "Users can join conversations created for them"
  on public.conversation_participants for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
      and c.created_by = auth.uid()
    )
  );

drop policy if exists "users can update own read state" on public.conversation_participants;
create policy "Users can update own read state"
  on public.conversation_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- public.conversation_pinned_messages
-- Note: table definition lives in migrations (added via migration); RLS policies here.
drop policy if exists "participants can pin messages" on public.conversation_pinned_messages;
create policy "Participants can pin messages"
  on public.conversation_pinned_messages for insert
  with check (
    pinned_by = auth.uid()
    and current_user_in_conversation(conversation_id)
  );

drop policy if exists "participants can unpin messages" on public.conversation_pinned_messages;
create policy "Participants can unpin messages"
  on public.conversation_pinned_messages for delete
  using (current_user_in_conversation(conversation_id));

drop policy if exists "participants can view pinned messages" on public.conversation_pinned_messages;
create policy "Participants can view pinned messages"
  on public.conversation_pinned_messages for select
  using (current_user_in_conversation(conversation_id));


-- public.messages
drop policy if exists "participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
        and cp.request_status = 'active'
    )
  );

drop policy if exists "participants can view messages" on public.messages;
create policy "Participants can view messages"
  on public.messages for select
  using (current_user_in_conversation(conversation_id));


-- public.message_deliveries
-- Note: table definition lives in migrations; RLS policies here.
drop policy if exists "participants can view deliveries" on public.message_deliveries;
create policy "Participants can view deliveries"
  on public.message_deliveries for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_deliveries.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "users can update own delivery record" on public.message_deliveries;
create policy "Users can update own delivery record"
  on public.message_deliveries for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can upsert own delivery record" on public.message_deliveries;
create policy "Users can upsert own delivery record"
  on public.message_deliveries for insert
  with check (user_id = auth.uid());


-- public.message_reactions
-- Note: table definition lives in migrations; RLS policies here.
drop policy if exists "participants can react" on public.message_reactions;
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

drop policy if exists "participants can view reactions" on public.message_reactions;
create policy "Participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
      and current_user_in_conversation(m.conversation_id)
    )
  );

drop policy if exists "users can remove own reactions" on public.message_reactions;
create policy "Users can remove own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());


-- place_stubs
drop policy if exists "place_stubs_select" on place_stubs;
create policy "place_stubs_select"
  on place_stubs for select
  using (expires_at > now());


-- ---------------------------------------------------------------------------
-- public.user_topic_follows
-- Note: table definition lives in migrations; RLS policies here.
-- ---------------------------------------------------------------------------

drop policy if exists "users can view own topic follows" on public.user_topic_follows;
create policy "Users can view own topic follows"
  on public.user_topic_follows for select
  using (auth.uid() = user_id);

drop policy if exists "users manage own topic follows" on public.user_topic_follows;
create policy "Users manage own topic follows"
  on public.user_topic_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
