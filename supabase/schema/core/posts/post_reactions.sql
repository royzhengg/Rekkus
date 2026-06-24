-- Domain: Core
-- Owner: Content
-- Classification: Relationship
-- Lifecycle: Core
-- Source of Truth: Yes

-- post_reactions
create table if not exists public.post_reactions (
  id            uuid        default gen_random_uuid() primary key,
  post_id       uuid        not null references public.posts(id) on delete cascade,
  user_id       uuid        not null references public.users(id) on delete cascade,
  reaction_type text        not null check (reaction_type in ('helpful', 'love', 'thanks', 'oh_no')),
  created_at    timestamptz default now(),
  unique (post_id, user_id, reaction_type)
);
