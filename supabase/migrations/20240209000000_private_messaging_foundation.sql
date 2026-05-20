-- Private messaging foundation for deferred direct messages.

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  conversation_type text not null default 'direct' check (conversation_type in ('direct')),
  created_by uuid references public.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create table if not exists public.conversation_participants (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  last_read_message_id uuid,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations on delete cascade not null,
  sender_id uuid references public.users on delete cascade not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.messages enable row level security;

alter table public.conversation_participants
  add constraint conversation_participants_last_read_message_fkey
  foreign key (last_read_message_id) references public.messages(id) on delete set null;

create policy "Participants can view conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
    )
  );

create policy "Users can create conversations"
  on public.conversations for insert
  with check (created_by = auth.uid());

create policy "Participants can view participants"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants own
      where own.conversation_id = conversation_participants.conversation_id
      and own.user_id = auth.uid()
    )
  );

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

create policy "Users can update own read state"
  on public.conversation_participants for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
    )
  );

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at desc);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
