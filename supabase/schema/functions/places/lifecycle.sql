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
