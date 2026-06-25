-- Domain: Functions / Places
-- Owner: Discovery
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- create_user_place
create or replace function public.create_user_place(
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
  v_place_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'place name is required';
  end if;

  insert into public.places (
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
  returning id into v_place_id;

  insert into public.place_provenance (
    place_id,
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
    v_place_id,
    'user_created',
    v_place_id::text,
    jsonb_build_object('name', trim(p_name), 'city', nullif(trim(coalesce(p_city, '')), '')),
    'first_party_user_submission',
    false,
    'first_party',
    'retain_until_unlinked_or_place_deleted',
    0.55,
    v_user_id
  );

  insert into public.place_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    place_id,
    source_type,
    reason,
    after_summary,
    compliance_category
  )
  values (
    'user',
    v_user_id,
    'place_created',
    'place',
    v_place_id,
    v_place_id,
    'user_created',
    'first_party_place_submission',
    jsonb_build_object('name', trim(p_name), 'verification_status', 'community_pending'),
    'place_data_independence'
  );

  return v_place_id;
end;
$$;

-- get_places_for_google_sync
create or replace function public.get_places_for_google_sync(
  batch_size integer default 25
)
returns table (
  id              uuid,
  google_place_id text,
  place_status    public.place_status
)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select p.id, p.google_place_id, p.place_status
  from   public.places p
  left join public.place_provider_cache c
    on  c.place_id    = p.id
    and c.source_type = 'google_places'
  where  p.google_place_id is not null
    and  p.status_locked = false
    and  (
      p.place_status != 'permanently_closed'
      or c.stale_at is null
      or c.stale_at < now() - interval '90 days'
    )
  order by c.stale_at asc nulls first, p.id
  limit batch_size;
$$;

-- acquire_google_sync_lock
create or replace function public.acquire_google_sync_lock()
returns boolean
  language sql
  security definer
  set search_path = public
as $$
  select pg_try_advisory_lock(hashtext('rekkus:google-operational-sync')::bigint);
$$;

-- release_google_sync_lock
create or replace function public.release_google_sync_lock()
returns void
  language sql
  security definer
  set search_path = public
as $$
  select pg_advisory_unlock(hashtext('rekkus:google-operational-sync')::bigint);
$$;

-- trigger_google_operational_sync
create or replace function public.trigger_google_operational_sync()
returns void
  language plpgsql
  security definer
  set search_path = public, net
as $$
declare
  v_url text;
  v_key text;
begin
  select value into v_url from public.app_config where key = 'supabase_url';
  select value into v_key from public.app_config where key = 'service_role_key';

  if v_url is null or v_key is null then
    raise warning 'trigger_google_operational_sync: missing app_config keys (supabase_url / service_role_key)';
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/google-operational-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key,
      'x-cron-key',    v_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;
