-- Unified compliance read surface across all domain audit tables.
--
-- Common schema: id, source_table, entity_type, entity_id, user_id, event_type, context, created_at
--
-- SECURITY INVOKER (default) — source-table RLS applies automatically per caller:
--   auth_audit_events          → USING(false): service-role only
--   content_lifecycle_events   → USING(false): service-role only
--   dish_audit_events          → USING(false): service-role only
--   moderation_actions         → SELECT for reporters of the linked report
--   post_edit_events           → SELECT WHERE auth.uid() = user_id
--   restaurant_audit_events    → SELECT TO authenticated
--
-- Extensibility contract: when adding a new *_audit_events table, add a UNION ALL arm
-- to this view in the same migration. The check:audit guardrail enforces this at CI time.

CREATE OR REPLACE VIEW public.platform_audit_events_view AS

  -- Authentication lifecycle (ISO A.12.4.1)
  SELECT
    id,
    'auth_audit_events'::text              AS source_table,
    'auth'::text                           AS entity_type,
    NULL::uuid                             AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.auth_audit_events

  UNION ALL

  -- Post and comment creation / deletion / restoration
  SELECT
    id,
    'content_lifecycle_events'::text       AS source_table,
    entity_type,
    entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.content_lifecycle_events

  UNION ALL

  -- Dish graph events (creation, merge, update)
  SELECT
    id,
    'dish_audit_events'::text              AS source_table,
    'dish'::text                           AS entity_type,
    dish_id                                AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.dish_audit_events

  UNION ALL

  -- Content moderation actions (hide, ban, restore, warn, escalate)
  SELECT
    id,
    'moderation_actions'::text             AS source_table,
    target_type                            AS entity_type,
    target_id                              AS entity_id,
    actor_id                               AS user_id,
    action_type                            AS event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type',  actor_type,
      'reason',      reason,
      'reversible',  reversible,
      'shadow_mode', shadow_mode,
      'report_id',   report_id
    )) || COALESCE(metadata, '{}'::jsonb)  AS context,
    created_at
  FROM public.moderation_actions

  UNION ALL

  -- Post edit lifecycle (field names only; never raw content)
  SELECT
    id,
    'post_edit_events'::text               AS source_table,
    'post'::text                           AS entity_type,
    post_id                                AS entity_id,
    user_id,
    event_type,
    jsonb_build_object(
      'changed_fields',      changed_fields,
      'changed_field_count', changed_field_count
    )                                      AS context,
    created_at
  FROM public.post_edit_events

  UNION ALL

  -- Restaurant compliance, data-quality, and operational events
  SELECT
    id,
    'restaurant_audit_events'::text                      AS source_table,
    COALESCE(entity_type, 'restaurant')::text            AS entity_type,
    COALESCE(entity_id, restaurant_id)                   AS entity_id,
    actor_id                                             AS user_id,
    action                                               AS event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'actor_type',          actor_type,
      'source_type',         source_type,
      'reason',              reason,
      'before_summary',      before_summary,
      'after_summary',       after_summary,
      'compliance_category', compliance_category,
      'restaurant_id',       restaurant_id,
      'request_id',          request_id,
      'job_id',              job_id,
      'rollback_reference',  rollback_reference
    ))                                                   AS context,
    created_at
  FROM public.restaurant_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
