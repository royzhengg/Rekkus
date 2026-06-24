-- Domain: Moderation
-- Owner: Trust & Safety
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- user_blocks
create table if not exists public.user_blocks (
  id         uuid        default gen_random_uuid() primary key,
  blocker_id uuid        references public.users on delete cascade not null,
  blocked_id uuid        references public.users on delete cascade not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- content_reports
create table if not exists public.content_reports (
  id             uuid        default gen_random_uuid() primary key,
  reporter_id    uuid        references public.users on delete set null,
  target_type    text        not null check (target_type in ('post', 'comment', 'user', 'place')),
  target_id      uuid        not null,
  report_type    text        not null default 'content_report' check (report_type in (
                               'content_report', 'fake_review', 'incentive_disclosure', 'dispute', 'takedown')),
  reason         text        not null check (char_length(reason) between 3 and 80),
  details        text,
  source_surface text        not null default 'app',
  status         text        not null default 'open' check (status in (
                               'open', 'triaged', 'actioned', 'dismissed', 'appealed', 'closed')),
  priority       text        not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  shadow_mode    boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- moderation_actions
create table if not exists public.moderation_actions (
  id          uuid        default gen_random_uuid() primary key,
  report_id   uuid        references public.content_reports on delete set null,
  actor_id    uuid        references public.users on delete set null,
  actor_type  text        not null default 'system' check (actor_type in ('user', 'admin', 'system', 'service')),
  action_type text        not null check (action_type in (
                            'triage', 'hide_content', 'restore_content', 'warn_user',
                            'restrict_user', 'dismiss_report', 'escalate', 'note')),
  target_type text        not null check (target_type in ('post', 'comment', 'user', 'place')),
  target_id   uuid        not null,
  reason      text        not null,
  reversible  boolean     not null default true,
  shadow_mode boolean     not null default false,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- moderation_appeals
create table if not exists public.moderation_appeals (
  id           uuid        default gen_random_uuid() primary key,
  report_id    uuid        references public.content_reports on delete set null,
  action_id    uuid        references public.moderation_actions on delete set null,
  appellant_id uuid        references public.users on delete set null,
  reason       text        not null,
  status       text        not null default 'open' check (status in (
                             'open', 'reviewing', 'upheld', 'reversed', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists content_reports_status_created_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
