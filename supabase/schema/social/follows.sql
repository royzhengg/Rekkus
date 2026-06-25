-- ============================================================================
-- Domain:       Social
-- Owner:        Growth
-- Canonical:    Yes
-- Lifecycle:    Core
-- Owned tables: follows, user_topic_follows
-- Dependencies: core/users/users.sql
-- Included by:  scripts/build-schema.sh
-- ============================================================================

-- follows
create table if not exists public.follows (
  id           uuid        default gen_random_uuid() primary key,
  follower_id  uuid        references public.users on delete cascade not null,
  following_id uuid        references public.users on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id)
);

-- user_topic_follows: topic interest signals captured at onboarding, profile, or search.
create table if not exists public.user_topic_follows (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.users on delete cascade not null,
  topic      text not null check (char_length(topic) between 2 and 40),
  source     text not null default 'onboarding'
             check (source in ('onboarding', 'profile', 'search', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, topic)
);

create index if not exists user_topic_follows_user_topic_idx
  on public.user_topic_follows (user_id, topic);
