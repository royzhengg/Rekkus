-- Domain: Core
-- Owner: Content
-- Classification: Relationship
-- Lifecycle: Core
-- Source of Truth: Yes

-- hashtags
create table if not exists public.hashtags (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null unique,
  created_at timestamptz not null default now()
);

-- post_hashtags
create table if not exists public.post_hashtags (
  post_id    uuid references public.posts on delete cascade,
  hashtag_id uuid references public.hashtags on delete cascade,
  primary key (post_id, hashtag_id)
);

-- likes
create table if not exists public.likes (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users on delete cascade not null,
  post_id    uuid        references public.posts on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- saves
create table if not exists public.saves (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.users on delete cascade not null,
  post_id    uuid        references public.posts on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
