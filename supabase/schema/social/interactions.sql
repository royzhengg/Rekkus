-- Domain: Social
-- Owner: Growth
-- Classification: Relationship
-- Lifecycle: Core
-- Source of Truth: Yes

-- saved_places
create table if not exists public.saved_places (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references public.users on delete cascade not null,
  place_id      uuid        references public.places on delete cascade not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

-- push_tokens
create table if not exists public.push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  token      text        not null,
  platform   text        not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

-- user_top_spots
create table if not exists public.user_top_spots (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  position      smallint    not null check (position between 1 and 3),
  place_id      uuid        not null references public.places(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, position),
  unique (user_id, place_id)
);

-- Indexes
create index if not exists user_top_spots_user_position on public.user_top_spots (user_id, position asc);
