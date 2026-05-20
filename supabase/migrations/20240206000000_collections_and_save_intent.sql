-- Collections, shareable boards, and saved-place intent foundations.

alter table public.saved_locations
  add column if not exists save_status text not null default 'want_to_try'
  check (save_status in ('want_to_try', 'been_here'));

alter table public.saved_locations
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.collections enable row level security;

create policy "Users can view own collections"
  on public.collections for select
  using (auth.uid() = user_id or visibility in ('unlisted', 'public'));

create policy "Users manage own collections"
  on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.collection_items (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references public.collections on delete cascade not null,
  target_type text not null check (target_type in ('restaurant', 'post')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (collection_id, target_type, target_id)
);

alter table public.collection_items enable row level security;

create policy "Users can view own or shareable collection items"
  on public.collection_items for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
      and (c.user_id = auth.uid() or c.visibility in ('unlisted', 'public'))
    )
  );

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

create index if not exists collections_user_visibility_idx
  on public.collections (user_id, visibility, updated_at desc);

create index if not exists collection_items_target_idx
  on public.collection_items (target_type, target_id);
