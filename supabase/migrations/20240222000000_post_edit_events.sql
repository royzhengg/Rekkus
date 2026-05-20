-- Add privacy-minimized post edit safety fields and audit evidence.

alter table public.posts
  add column if not exists last_edited_at timestamptz,
  add column if not exists edit_count integer not null default 0;

create table if not exists public.post_edit_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'edit_started',
      'edit_saved',
      'edit_discarded',
      'edit_conflict',
      'media_replaced'
    )
  ),
  changed_fields text[] not null default '{}',
  changed_field_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.post_edit_events enable row level security;

create index if not exists post_edit_events_post_created_idx
  on public.post_edit_events(post_id, created_at desc);

create index if not exists post_edit_events_user_created_idx
  on public.post_edit_events(user_id, created_at desc);

drop policy if exists "Users can view their own post edit events" on public.post_edit_events;
create policy "Users can view their own post edit events"
  on public.post_edit_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own post edit events" on public.post_edit_events;
create policy "Users can create their own post edit events"
  on public.post_edit_events
  for insert
  with check (
    auth.uid() = user_id
    and auth.uid() = (
      select p.user_id
      from public.posts p
      where p.id = post_id
    )
  );

comment on table public.post_edit_events is
  'Privacy-minimized post edit audit events. Stores changed field names/count only; never raw captions, media URLs, addresses, or before/after content.';
