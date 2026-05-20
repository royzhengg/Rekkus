-- Restaurant ownership, merge, and repair history for audit-safe graph maintenance.

create table if not exists public.restaurant_ownership_events (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  event_type text not null check (event_type in ('claim_submitted', 'claim_approved', 'claim_rejected', 'ownership_transferred', 'ownership_removed')),
  actor_id uuid references public.users(id) on delete set null,
  previous_owner_id uuid references public.users(id) on delete set null,
  new_owner_id uuid references public.users(id) on delete set null,
  source_type text not null default 'owner_submitted',
  reason text,
  evidence_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  audit_event_id uuid references public.restaurant_audit_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurant_ownership_events_restaurant
  on public.restaurant_ownership_events (restaurant_id, created_at desc);

create index if not exists idx_restaurant_ownership_events_actor
  on public.restaurant_ownership_events (actor_id, created_at desc);

alter table public.restaurant_ownership_events enable row level security;

create policy "Authenticated users can view restaurant ownership events"
  on public.restaurant_ownership_events for select
  to authenticated
  using (true);

create policy "Users can submit own restaurant claims"
  on public.restaurant_ownership_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and event_type = 'claim_submitted'
    and status = 'pending'
  );

create policy "Users can submit restaurant alias suggestions"
  on public.restaurant_aliases for insert
  to authenticated
  with check (created_by = auth.uid() and status = 'active');

create table if not exists public.restaurant_merge_events (
  id uuid default gen_random_uuid() primary key,
  canonical_restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  merged_restaurant_id uuid references public.restaurants(id) on delete set null,
  actor_id uuid references public.users(id) on delete set null,
  reason text not null,
  confidence numeric(3,2) not null default 0.50,
  before_summary jsonb not null default '{}'::jsonb,
  after_summary jsonb not null default '{}'::jsonb,
  rollback_reference text,
  audit_event_id uuid references public.restaurant_audit_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurant_merge_events_canonical
  on public.restaurant_merge_events (canonical_restaurant_id, created_at desc);

create index if not exists idx_restaurant_merge_events_merged
  on public.restaurant_merge_events (merged_restaurant_id, created_at desc);

alter table public.restaurant_merge_events enable row level security;

create policy "Authenticated users can view restaurant merge events"
  on public.restaurant_merge_events for select
  to authenticated
  using (true);

create table if not exists public.data_repair_events (
  id uuid default gen_random_uuid() primary key,
  entity_type text not null check (entity_type in ('restaurant', 'post', 'dish', 'user')),
  entity_id uuid,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  actor_id uuid references public.users(id) on delete set null,
  repair_type text not null,
  source_type text not null default 'user_report',
  issue_summary text not null,
  before_summary jsonb not null default '{}'::jsonb,
  after_summary jsonb not null default '{}'::jsonb,
  status text not null default 'reported' check (status in ('reported', 'in_review', 'repaired', 'rejected', 'superseded')),
  audit_event_id uuid references public.restaurant_audit_events(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

create index if not exists idx_data_repair_events_entity
  on public.data_repair_events (entity_type, entity_id, created_at desc);

create index if not exists idx_data_repair_events_restaurant
  on public.data_repair_events (restaurant_id, created_at desc);

create index if not exists idx_data_repair_events_actor
  on public.data_repair_events (actor_id, created_at desc);

alter table public.data_repair_events enable row level security;

create policy "Users can view own repair reports"
  on public.data_repair_events for select
  to authenticated
  using (actor_id = auth.uid());

create policy "Users can submit own repair reports"
  on public.data_repair_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and source_type = 'user_report'
    and status = 'reported'
  );
