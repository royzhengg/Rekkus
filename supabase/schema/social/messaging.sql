-- ============================================================================
-- Domain:       Social
-- Owner:        Messaging
-- Canonical:    Yes
-- Lifecycle:    Core
-- Owned tables: conversations, conversation_participants, messages, message_reactions, message_deliveries, conversation_pinned_messages
-- Dependencies: core/users/users.sql
-- Included by:  scripts/build-schema.sh
-- ============================================================================

-- conversations
create table if not exists public.conversations (
  id                uuid        default gen_random_uuid() primary key,
  conversation_type text        not null default 'direct' check (conversation_type in ('direct')),
  status            text        not null default 'active',
  name              text,
  avatar_url        text,
  created_by        uuid        references public.users on delete set null,
  direct_user_low   uuid        references public.users on delete cascade,
  direct_user_high  uuid        references public.users on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- conversation_participants
create table if not exists public.conversation_participants (
  id                  uuid        default gen_random_uuid() primary key,
  conversation_id     uuid        references public.conversations on delete cascade not null,
  user_id             uuid        references public.users on delete cascade not null,
  last_read_message_id uuid,
  last_read_at        timestamptz,
  pinned_message_id   uuid,
  muted_until         timestamptz,
  pinned_at           timestamptz,
  archived_at         timestamptz,
  is_admin            boolean     not null default false,
  last_seen_at        timestamptz,
  request_status      text        not null default 'active',
  requested_by        uuid        references public.users(id) on delete set null,
  requested_at        timestamptz,
  request_decided_at  timestamptz,
  created_at          timestamptz not null default now(),
  unique (conversation_id, user_id)
);

-- messages
create table if not exists public.messages (
  id                 uuid        default gen_random_uuid() primary key,
  conversation_id    uuid        references public.conversations on delete cascade not null,
  sender_id          uuid        references public.users on delete cascade not null,
  body               text        not null check (char_length(body) between 1 and 2000),
  message_type       text        not null default 'text',
  attachment_url     text,
  attachment_metadata jsonb,
  reply_to_message_id uuid       references public.messages(id) on delete set null,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now()
);

-- Indexes
create index if not exists conversations_updated_at_idx on public.conversations (updated_at desc);
create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id, conversation_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- message_reactions: per-message emoji reactions; one reaction per user per message.
create table if not exists public.message_reactions (
  id         uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id    uuid references public.users(id) on delete cascade not null,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

-- message_deliveries: per-message read receipts; upserted by the recipient.
create table if not exists public.message_deliveries (
  message_id   uuid references public.messages(id) on delete cascade not null,
  user_id      uuid references public.users(id) on delete cascade not null,
  delivered_at timestamptz,
  read_at      timestamptz,
  primary key (message_id, user_id)
);

-- conversation_pinned_messages: multiple pinned messages per conversation.
create table if not exists public.conversation_pinned_messages (
  id              uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  message_id      uuid references public.messages(id) on delete cascade not null,
  pinned_by       uuid references public.users(id) on delete set null,
  pinned_at       timestamptz not null default now(),
  unique (conversation_id, message_id)
);
