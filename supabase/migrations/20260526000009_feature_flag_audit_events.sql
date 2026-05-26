-- B-521: Audit every runtime feature flag override mutation at its database boundary.
-- The trigger is intentionally fail closed: an override cannot commit without its audit row.

CREATE TABLE public.feature_flag_audit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name  text        NOT NULL,
  user_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text        NOT NULL CHECK (event_type IN (
    'override_created', 'override_updated', 'override_removed'
  )),
  context    jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flag_audit_events IS
  'Append-only audit trail for runtime feature flag override mutations. '
  'Written automatically by a fail-closed trigger on feature_flag_overrides. '
  'Context stores operational state only: enabled, reason, expiry, operation, and source.';

ALTER TABLE public.feature_flag_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to feature flag audit events"
  ON public.feature_flag_audit_events FOR ALL USING (false);

CREATE INDEX feature_flag_audit_events_flag_name_idx
  ON public.feature_flag_audit_events (flag_name, created_at DESC);
CREATE INDEX feature_flag_audit_events_user_id_idx
  ON public.feature_flag_audit_events (user_id);
CREATE INDEX feature_flag_audit_events_created_at_idx
  ON public.feature_flag_audit_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.feature_flag_audit_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'override_created';
    INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
    VALUES (
      NEW.flag_name,
      NEW.updated_by,
      v_event_type,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'new_enabled', NEW.enabled,
        'new_reason', NEW.reason,
        'new_expires_at', NEW.expires_at
      ))
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_event_type := 'override_updated';
    INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
    VALUES (
      NEW.flag_name,
      NEW.updated_by,
      v_event_type,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'old_enabled', OLD.enabled,
        'new_enabled', NEW.enabled,
        'old_reason', OLD.reason,
        'new_reason', NEW.reason,
        'old_expires_at', OLD.expires_at,
        'new_expires_at', NEW.expires_at
      ))
    );
    RETURN NEW;
  END IF;

  v_event_type := 'override_removed';
  INSERT INTO public.feature_flag_audit_events (flag_name, user_id, event_type, context)
  VALUES (
    OLD.flag_name,
    NULL,
    v_event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'operation', TG_OP,
      'source', 'database_trigger',
      'old_enabled', OLD.enabled,
      'old_reason', OLD.reason,
      'old_expires_at', OLD.expires_at,
      'previous_updated_by', OLD.updated_by
    ))
  );
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.feature_flag_audit_trigger FROM PUBLIC;

CREATE TRIGGER feature_flag_override_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.feature_flag_audit_trigger();

CREATE OR REPLACE VIEW public.platform_audit_events_view AS

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
  FROM public.restaurant_audit_events

  UNION ALL

  SELECT
    id,
    'user_profile_audit_events'::text      AS source_table,
    'user_profile'::text                   AS entity_type,
    user_id                                AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.user_profile_audit_events

  UNION ALL

  SELECT
    id,
    'collection_audit_events'::text        AS source_table,
    'collection'::text                     AS entity_type,
    collection_id                          AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.collection_audit_events

  UNION ALL

  SELECT
    id,
    'feature_flag_audit_events'::text      AS source_table,
    'feature_flag'::text                   AS entity_type,
    NULL::uuid                             AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.feature_flag_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
