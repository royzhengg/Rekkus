-- Domain: Social
-- Owner: Growth
-- Classification: Relationship
-- Lifecycle: Core
-- Source of Truth: Yes

-- follows
create table if not exists public.follows (
  id           uuid        default gen_random_uuid() primary key,
  follower_id  uuid        references public.users on delete cascade not null,
  following_id uuid        references public.users on delete cascade not null,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id)
);
