-- Restaurant data independence: first-party provenance, community evidence, and display precedence.

alter table public.restaurants
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'community_pending', 'community_verified', 'owner_verified', 'rejected')),
  add column if not exists community_verification_score integer not null default 0,
  add column if not exists community_verified_at timestamptz,
  add column if not exists owner_content_status text not null default 'none'
    check (owner_content_status in ('none', 'pending', 'active', 'rejected', 'superseded')),
  add column if not exists metadata_source_priority text not null default 'rekkus_first'
    check (metadata_source_priority in ('rekkus_first', 'owner_first', 'provider_fallback')),
  add column if not exists primary_photo_source text not null default 'rekkus_post'
    check (primary_photo_source in ('rekkus_post', 'owner_submitted', 'provider_fallback'));

create index if not exists idx_restaurants_created_by
  on public.restaurants (created_by, created_at desc);

create index if not exists idx_restaurants_verification_status
  on public.restaurants (verification_status, community_verification_score desc);

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

create policy "Users can view own created restaurant provenance"
  on public.restaurants for select
  to authenticated
  using (created_by = auth.uid());

create policy "Users can submit duplicate restaurant evidence"
  on public.restaurant_merge_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and merged_restaurant_id is null
    and rollback_reference = 'no_merge_performed'
  );

create or replace function public.create_user_restaurant(
  p_name text,
  p_address text default null,
  p_city text default null,
  p_country text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_cuisine_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'restaurant name is required';
  end if;

  insert into public.restaurants (
    name,
    address,
    city,
    country,
    latitude,
    longitude,
    cuisine_type,
    created_by,
    canonical_source,
    metadata_confidence,
    verification_status,
    metadata_source_priority,
    primary_photo_source
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    p_latitude,
    p_longitude,
    nullif(trim(coalesce(p_cuisine_type, '')), ''),
    v_user_id,
    'user_created',
    0.55,
    'community_pending',
    'rekkus_first',
    'rekkus_post'
  )
  returning id into v_restaurant_id;

  insert into public.restaurant_sources (
    restaurant_id,
    source_type,
    source_id,
    source_payload,
    source_rights,
    attribution_required,
    cacheability,
    retention_policy,
    confidence,
    created_by
  )
  values (
    v_restaurant_id,
    'user_created',
    v_restaurant_id::text,
    jsonb_build_object('name', trim(p_name), 'city', nullif(trim(coalesce(p_city, '')), '')),
    'first_party_user_submission',
    false,
    'first_party',
    'retain_until_unlinked_or_restaurant_deleted',
    0.55,
    v_user_id
  );

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
    v_user_id,
    'restaurant_created',
    'restaurant',
    v_restaurant_id,
    v_restaurant_id,
    'user_created',
    'first_party_restaurant_submission',
    jsonb_build_object('name', trim(p_name), 'verification_status', 'community_pending'),
    'restaurant_data_independence'
  );

  return v_restaurant_id;
end;
$$;
