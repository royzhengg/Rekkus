-- B-517: User profile audit events
-- Compliance gap: no record of who changed their username, avatar, bio, or display name, or when.
-- Username changes can enable impersonation; ISO A.12.4 requires an audit trail.
-- Writes exclusively via SECURITY DEFINER RPC — USING(false) blocks all direct client writes.

CREATE TABLE public.user_profile_audit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text        NOT NULL CHECK (event_type IN ('profile_updated', 'avatar_changed')),
  context    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profile_audit_events IS
  'ISO A.12.4 audit trail for user profile field changes. Append-only. '
  'context.changed_fields lists field names only — never raw values. '
  'user_id uses ON DELETE SET NULL so records survive account deletion.';

COMMENT ON COLUMN public.user_profile_audit_events.user_id IS
  'Profile owner who made the change. ON DELETE SET NULL — audit record must outlive the user account.';

ALTER TABLE public.user_profile_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to user profile audit events"
  ON public.user_profile_audit_events FOR ALL USING (false);

CREATE INDEX user_profile_audit_events_user_id_idx
  ON public.user_profile_audit_events (user_id);
CREATE INDEX user_profile_audit_events_created_at_idx
  ON public.user_profile_audit_events (created_at DESC);
CREATE INDEX user_profile_audit_events_event_type_idx
  ON public.user_profile_audit_events (event_type, created_at DESC);

-- SECURITY DEFINER: auth.uid() is resolved at call time so user_id is always the authenticated caller.
-- Client cannot spoof a different user_id.
CREATE OR REPLACE FUNCTION public.record_profile_audit_event(
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profile_audit_events (user_id, event_type, context)
  VALUES (auth.uid(), p_event_type, p_context);
END;
$$;

REVOKE ALL ON FUNCTION public.record_profile_audit_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_profile_audit_event TO authenticated;

-- Update unified compliance view to include user profile audit arm.
-- Extensibility contract: add a UNION ALL arm here whenever a new *_audit_events table is created.
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
  FROM public.restaurant_audit_events

  UNION ALL

  -- User profile field changes (username, avatar, bio, display name)
  SELECT
    id,
    'user_profile_audit_events'::text      AS source_table,
    'user_profile'::text                   AS entity_type,
    user_id                                AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.user_profile_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
