-- Rename record_restaurant_provider_snapshot → record_place_provider_snapshot.
-- This is a new function (with the updated table/column references) that replaces the old one.

create or replace function public.record_place_provider_snapshot(
  p_place_id uuid,
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

  if p_place_id is null or p_source_type is null or p_source_id is null then
    raise exception 'place_id, source_type, and source_id are required';
  end if;

  insert into public.place_provenance (
    place_id,
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
    p_place_id,
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
    place_id = excluded.place_id,
    attribution_required = excluded.attribution_required,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    updated_at = now();

  insert into public.place_provider_cache (
    place_id,
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
    p_place_id,
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
    place_id = excluded.place_id,
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
    auth.uid(),
    'provider_snapshot_recorded',
    'place_provider_cache',
    p_place_id,
    p_place_id,
    p_source_type,
    'provider_fallback_or_location_selection',
    jsonb_build_object('source_id', p_source_id, 'field_mask', p_field_mask),
    'provider_data'
  );
end;
$$;

-- Drop the old function now that the new one is live.
drop function if exists public.record_restaurant_provider_snapshot(
  uuid, text, text, text[], jsonb, boolean, text, text, text, timestamptz
);
