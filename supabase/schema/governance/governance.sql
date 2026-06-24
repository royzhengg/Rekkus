-- Domain: Governance
-- Owner: Platform / Legal
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- feature_flag_overrides
create table if not exists public.feature_flag_overrides (
  flag_name  text        primary key,
  enabled    boolean     not null,
  reason     text        not null,
  updated_by uuid        references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

-- privacy_requests
create table if not exists public.privacy_requests (
  id              uuid        default gen_random_uuid() primary key,
  user_id         uuid        not null references public.users(id) on delete cascade,
  request_type    text        not null check (request_type in ('export', 'deletion', 'correction', 'access')),
  status          text        not null default 'submitted' check (
                    status in ('submitted', 'in_review', 'completed', 'rejected', 'cancelled')),
  request_payload jsonb       not null default '{}'::jsonb,
  due_at          timestamptz,
  completed_at    timestamptz,
  audit_reference text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_feature_flag_overrides_active on public.feature_flag_overrides (flag_name)
  where expires_at is null or expires_at > now();
