-- Domain: Core
-- Owner: Content
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- comments
create table if not exists public.comments (
  id               uuid        default gen_random_uuid() primary key,
  user_id          uuid        references public.users on delete cascade not null,
  post_id          uuid        references public.posts on delete cascade not null,
  parent_id        uuid        references public.comments(id) on delete cascade,
  content          text        not null,
  deleted_at       timestamptz,
  deleted_reason   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes
create index if not exists comments_not_deleted_idx on public.comments (post_id, created_at) where deleted_at is null;
create index if not exists comments_parent_id_idx on public.comments (parent_id);
