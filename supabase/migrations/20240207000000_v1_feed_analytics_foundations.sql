-- V1 feed curation, topic follow, and analytics foundations.

alter table public.collections
  add column if not exists is_staff_pick boolean not null default false;

alter table public.collections
  add column if not exists curator_note text;

alter table public.collections
  add column if not exists display_order integer not null default 0;

create index if not exists collections_staff_picks_idx
  on public.collections (is_staff_pick, visibility, display_order, updated_at desc);

create table if not exists public.user_topic_follows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  topic text not null check (char_length(topic) between 2 and 40),
  source text not null default 'onboarding' check (source in ('onboarding', 'profile', 'search', 'system')),
  created_at timestamptz not null default now(),
  unique (user_id, topic)
);

alter table public.user_topic_follows enable row level security;

create policy "Users can view own topic follows"
  on public.user_topic_follows for select
  using (auth.uid() = user_id);

create policy "Users manage own topic follows"
  on public.user_topic_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_topic_follows_user_topic_idx
  on public.user_topic_follows (user_id, topic);
