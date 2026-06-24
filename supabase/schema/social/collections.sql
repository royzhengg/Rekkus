-- Domain: Social
-- Owner: Growth
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- collections
create table if not exists public.collections (
  id             uuid        default gen_random_uuid() primary key,
  user_id        uuid        references public.users on delete cascade not null,
  name           text        not null check (char_length(name) between 1 and 80),
  description    text,
  visibility     text        not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  share_slug     text        unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  deleted_reason text,
  unique (user_id, name)
);

-- collection_items
create table if not exists public.collection_items (
  id            uuid        default gen_random_uuid() primary key,
  collection_id uuid        references public.collections on delete cascade not null,
  target_type   text        not null check (target_type in ('place', 'post', 'dish')),
  target_id     uuid        not null,
  created_at    timestamptz not null default now(),
  unique (collection_id, target_type, target_id)
);

-- Indexes
create index if not exists collections_user_visibility_idx on public.collections (user_id, visibility, updated_at desc);
create index if not exists collections_not_deleted_idx on public.collections (user_id, updated_at desc) where deleted_at is null;
create index if not exists collection_items_target_idx on public.collection_items (target_type, target_id);
