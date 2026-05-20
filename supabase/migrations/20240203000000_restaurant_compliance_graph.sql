-- Provider-independent restaurant graph, local cache, observations, and audit trails.

alter table public.restaurants
  add column if not exists canonical_source text not null default 'rekkus',
  add column if not exists metadata_confidence numeric(3,2) not null default 0.50,
  add column if not exists google_details_fetched_at timestamptz,
  add column if not exists google_details_fields text[],
  add column if not exists google_business_status text,
  add column if not exists google_phone text,
  add column if not exists google_website text,
  add column if not exists google_price_level integer,
  add column if not exists google_types text[],
  add column if not exists google_opening_hours jsonb,
  add column if not exists google_photo_refs text[];

create index if not exists idx_restaurants_google_place_id
  on public.restaurants (google_place_id);

create index if not exists idx_restaurants_lower_name
  on public.restaurants (lower(name));

create index if not exists idx_restaurants_city
  on public.restaurants (city);

create index if not exists idx_restaurants_cuisine_type
  on public.restaurants (cuisine_type);

create table if not exists public.restaurant_sources (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_type text not null check (source_type in ('rekkus', 'google_places', 'osm', 'owner_submitted', 'user_created', 'admin_created', 'future_provider')),
  source_id text,
  source_payload jsonb,
  source_rights text not null default 'first_party',
  attribution_required boolean not null default false,
  cacheability text not null default 'permanent_identifier',
  retention_policy text not null default 'retain_until_unlinked_or_restaurant_deleted',
  confidence numeric(3,2) not null default 0.50,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_restaurant_sources_unique_source
  on public.restaurant_sources (source_type, source_id)
  where source_id is not null;

create index if not exists idx_restaurant_sources_restaurant
  on public.restaurant_sources (restaurant_id);

alter table public.restaurant_sources enable row level security;

create policy "Anyone can view restaurant sources"
  on public.restaurant_sources for select
  using (true);

create policy "Authenticated users can propose restaurant sources"
  on public.restaurant_sources for insert
  to authenticated
  with check (created_by = auth.uid() and source_type in ('user_created', 'owner_submitted'));

create table if not exists public.restaurant_provider_cache (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  field_mask text[],
  normalized_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  attribution_required boolean not null default false,
  attribution_text text,
  cacheability text not null,
  retention_policy text not null,
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh', 'stale', 'expired', 'restricted')),
  fetched_at timestamptz not null default now(),
  stale_at timestamptz,
  expires_at timestamptz,
  last_refresh_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists idx_restaurant_provider_cache_restaurant
  on public.restaurant_provider_cache (restaurant_id);

create index if not exists idx_restaurant_provider_cache_freshness
  on public.restaurant_provider_cache (source_type, freshness_state, stale_at, expires_at);

alter table public.restaurant_provider_cache enable row level security;

create policy "Anyone can view restaurant provider cache"
  on public.restaurant_provider_cache for select
  using (true);

create table if not exists public.restaurant_observations (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  observation_type text not null,
  observed_value jsonb not null,
  source_type text not null default 'first_party_user',
  source_entity_type text,
  source_entity_id uuid,
  confidence numeric(3,2) not null default 0.50,
  status text not null default 'pending' check (status in ('pending', 'trusted', 'rejected', 'superseded')),
  retention_policy text not null default 'retain_until_user_deletion_or_superseded',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null
);

create index if not exists idx_restaurant_observations_restaurant
  on public.restaurant_observations (restaurant_id, observation_type, status);

create index if not exists idx_restaurant_observations_user
  on public.restaurant_observations (user_id, created_at desc);

alter table public.restaurant_observations enable row level security;

create policy "Anyone can view trusted restaurant observations"
  on public.restaurant_observations for select
  using (status = 'trusted' or user_id = auth.uid());

create policy "Users can create own restaurant observations"
  on public.restaurant_observations for insert
  to authenticated
  with check (user_id = auth.uid());

create table if not exists public.restaurant_aliases (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text,
  provider_place_id text,
  alias_name text,
  alias_address text,
  reason text not null,
  confidence numeric(3,2) not null default 0.50,
  status text not null default 'active' check (status in ('active', 'superseded', 'rejected')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_restaurant_aliases_provider_place
  on public.restaurant_aliases (provider, provider_place_id)
  where provider is not null and provider_place_id is not null and status = 'active';

create index if not exists idx_restaurant_aliases_restaurant
  on public.restaurant_aliases (restaurant_id);

alter table public.restaurant_aliases enable row level security;

create policy "Anyone can view restaurant aliases"
  on public.restaurant_aliases for select
  using (true);

create table if not exists public.restaurant_audit_events (
  id uuid default gen_random_uuid() primary key,
  actor_type text not null default 'system',
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  source_type text,
  reason text,
  before_summary jsonb,
  after_summary jsonb,
  request_id text,
  job_id text,
  compliance_category text,
  rollback_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_restaurant_audit_events_restaurant
  on public.restaurant_audit_events (restaurant_id, created_at desc);

create index if not exists idx_restaurant_audit_events_entity
  on public.restaurant_audit_events (entity_type, entity_id, created_at desc);

alter table public.restaurant_audit_events enable row level security;

create policy "Authenticated users can view restaurant audit events"
  on public.restaurant_audit_events for select
  to authenticated
  using (true);

create table if not exists public.privacy_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion', 'correction', 'access')),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'completed', 'rejected', 'cancelled')),
  request_payload jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  audit_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_privacy_requests_user
  on public.privacy_requests (user_id, created_at desc);

alter table public.privacy_requests enable row level security;

create policy "Users can view own privacy requests"
  on public.privacy_requests for select
  using (auth.uid() = user_id);

create policy "Users can submit own privacy requests"
  on public.privacy_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.record_restaurant_provider_snapshot(
  p_restaurant_id uuid,
  p_source_type text,
  p_source_id text,
  p_field_mask text[],
  p_normalized_payload jsonb,
  p_attribution_required boolean,
  p_attribution_text text,
  p_cacheability text,
  p_retention_policy text,
  p_stale_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'authenticated role required';
  end if;

  if p_restaurant_id is null or p_source_type is null or p_source_id is null then
    raise exception 'restaurant_id, source_type, and source_id are required';
  end if;

  insert into public.restaurant_sources (
    restaurant_id,
    source_type,
    source_id,
    source_rights,
    attribution_required,
    cacheability,
    retention_policy,
    confidence,
    created_by,
    updated_at
  )
  values (
    p_restaurant_id,
    p_source_type,
    p_source_id,
    case when p_source_type = 'google_places' then 'provider_google' else 'source_terms_defined' end,
    p_attribution_required,
    p_cacheability,
    p_retention_policy,
    0.70,
    auth.uid(),
    now()
  )
  on conflict (source_type, source_id)
  do update set
    restaurant_id = excluded.restaurant_id,
    attribution_required = excluded.attribution_required,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    updated_at = now();

  insert into public.restaurant_provider_cache (
    restaurant_id,
    source_type,
    source_id,
    field_mask,
    normalized_payload,
    attribution_required,
    attribution_text,
    cacheability,
    retention_policy,
    freshness_state,
    fetched_at,
    stale_at,
    updated_at
  )
  values (
    p_restaurant_id,
    p_source_type,
    p_source_id,
    p_field_mask,
    coalesce(p_normalized_payload, '{}'::jsonb),
    p_attribution_required,
    p_attribution_text,
    p_cacheability,
    p_retention_policy,
    'fresh',
    now(),
    p_stale_at,
    now()
  )
  on conflict (source_type, source_id)
  do update set
    restaurant_id = excluded.restaurant_id,
    field_mask = excluded.field_mask,
    normalized_payload = excluded.normalized_payload,
    attribution_required = excluded.attribution_required,
    attribution_text = excluded.attribution_text,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    freshness_state = 'fresh',
    fetched_at = now(),
    stale_at = excluded.stale_at,
    updated_at = now();

  insert into public.restaurant_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    restaurant_id,
    source_type,
    reason,
    after_summary,
    compliance_category
  )
  values (
    'user',
    auth.uid(),
    'provider_snapshot_recorded',
    'restaurant_provider_cache',
    p_restaurant_id,
    p_restaurant_id,
    p_source_type,
    'provider_fallback_or_location_selection',
    jsonb_build_object('source_id', p_source_id, 'field_mask', p_field_mask),
    'provider_data'
  );
end;
$$;

revoke all on function public.record_restaurant_provider_snapshot(uuid, text, text, text[], jsonb, boolean, text, text, text, timestamptz) from public;
grant execute on function public.record_restaurant_provider_snapshot(uuid, text, text, text[], jsonb, boolean, text, text, text, timestamptz) to authenticated;
