-- Moderation, report/block, trust, and soft-delete foundations.

create table if not exists public.user_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references public.users on delete cascade not null,
  blocked_id uuid references public.users on delete cascade not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "Users can view their own blocks" on public.user_blocks
  for select using (auth.uid() = blocker_id);
create policy "Users can manage their own blocks" on public.user_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create table if not exists public.content_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.users on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'restaurant')),
  target_id uuid not null,
  report_type text not null default 'content_report' check (
    report_type in ('content_report', 'fake_review', 'incentive_disclosure', 'dispute', 'takedown')
  ),
  reason text not null check (char_length(reason) between 3 and 80),
  details text,
  source_surface text not null default 'app',
  status text not null default 'open' check (status in ('open', 'triaged', 'actioned', 'dismissed', 'appealed', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  shadow_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_reports enable row level security;
create policy "Users can view their own reports" on public.content_reports
  for select using (auth.uid() = reporter_id);
create policy "Authenticated users can create reports" on public.content_reports
  for insert with check (auth.uid() = reporter_id);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id);

create table if not exists public.moderation_actions (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.content_reports on delete set null,
  actor_id uuid references public.users on delete set null,
  actor_type text not null default 'system' check (actor_type in ('user', 'admin', 'system', 'service')),
  action_type text not null check (
    action_type in ('triage', 'hide_content', 'restore_content', 'warn_user', 'restrict_user', 'dismiss_report', 'escalate', 'note')
  ),
  target_type text not null check (target_type in ('post', 'comment', 'user', 'restaurant')),
  target_id uuid not null,
  reason text not null,
  reversible boolean not null default true,
  shadow_mode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
create policy "Authenticated users can view moderation actions they reported" on public.moderation_actions
  for select using (
    exists (
      select 1 from public.content_reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );

create table if not exists public.moderation_appeals (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.content_reports on delete set null,
  action_id uuid references public.moderation_actions on delete set null,
  appellant_id uuid references public.users on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'upheld', 'reversed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.moderation_appeals enable row level security;
create policy "Users can view their own moderation appeals" on public.moderation_appeals
  for select using (auth.uid() = appellant_id);
create policy "Users can create moderation appeals" on public.moderation_appeals
  for insert with check (auth.uid() = appellant_id);

create table if not exists public.user_trust_profiles (
  user_id uuid references public.users on delete cascade primary key,
  trust_level text not null default 'new' check (trust_level in ('new', 'standard', 'trusted', 'restricted')),
  score integer not null default 0 check (score between -100 and 100),
  reason_summary text,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_trust_profiles enable row level security;
create policy "Users can view their own trust profile" on public.user_trust_profiles
  for select using (auth.uid() = user_id);

alter table public.posts add column if not exists deleted_at timestamptz;
alter table public.posts add column if not exists deleted_reason text;
alter table public.comments add column if not exists deleted_at timestamptz;
alter table public.comments add column if not exists deleted_reason text;
alter table public.post_photos add column if not exists deleted_at timestamptz;

create index if not exists posts_not_deleted_idx on public.posts (created_at desc) where deleted_at is null;
create index if not exists comments_not_deleted_idx on public.comments (post_id, created_at) where deleted_at is null;
