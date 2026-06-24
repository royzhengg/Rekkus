-- Domain: Audit
-- Owner: Platform / Compliance
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------------

-- platform_audit_events_view: unified compliance read surface.
-- To extend: add a UNION ALL arm from the new *_audit_events table in the same
-- migration as the new table. Maps to (id, source_table, entity_type, entity_id,
-- user_id, event_type, context, created_at).
create or replace view public.platform_audit_events_view as

  select id, 'auth_audit_events'::text as source_table,
    'auth'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.auth_audit_events

  union all

  select id, 'content_lifecycle_events'::text as source_table,
    entity_type, entity_id, user_id, event_type, context, created_at
  from public.content_lifecycle_events

  union all

  select id, 'dish_audit_events'::text as source_table,
    'dish'::text as entity_type, dish_id as entity_id,
    user_id, event_type, context, created_at
  from public.dish_audit_events

  union all

  select id, 'moderation_actions'::text as source_table,
    target_type as entity_type, target_id as entity_id,
    actor_id as user_id, action_type as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'reason', reason,
      'reversible', reversible, 'shadow_mode', shadow_mode, 'report_id', report_id
    )) || coalesce(metadata, '{}'::jsonb) as context,
    created_at
  from public.moderation_actions

  union all

  select id, 'post_edit_events'::text as source_table,
    'post'::text as entity_type, post_id as entity_id,
    user_id, event_type,
    jsonb_build_object('changed_fields', changed_fields, 'changed_field_count', changed_field_count) as context,
    created_at
  from public.post_edit_events

  union all

  select id, 'restaurant_audit_events'::text as source_table,
    coalesce(entity_type, 'restaurant')::text as entity_type,
    coalesce(entity_id, restaurant_id) as entity_id,
    actor_id as user_id, action as event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type', actor_type, 'source_type', source_type, 'reason', reason,
      'before_summary', before_summary, 'after_summary', after_summary,
      'compliance_category', compliance_category, 'restaurant_id', restaurant_id,
      'request_id', request_id, 'job_id', job_id, 'rollback_reference', rollback_reference
    )) as context,
    created_at
  from public.restaurant_audit_events

  union all

  select id, 'user_profile_audit_events'::text as source_table,
    'user_profile'::text as entity_type, user_id as entity_id,
    user_id, event_type, context, created_at
  from public.user_profile_audit_events

  union all

  select id, 'collection_audit_events'::text as source_table,
    'collection'::text as entity_type, collection_id as entity_id,
    user_id, event_type, context, created_at
  from public.collection_audit_events

  union all

  select id, 'feature_flag_audit_events'::text as source_table,
    'feature_flag'::text as entity_type, null::uuid as entity_id,
    user_id, event_type, context, created_at
  from public.feature_flag_audit_events

  union all

  select id, 'saved_search_audit_events'::text as source_table,
    'saved_search'::text as entity_type, saved_search_id as entity_id,
    user_id, event_type, context, created_at
  from public.saved_search_audit_events;
