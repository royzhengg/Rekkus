-- B-518: Collection audit events
-- Compliance gap: collection CRUD (create, rename, delete, add/remove items, make-shareable)
-- leaves no audit trail. No compliance evidence for collection lifecycle.
-- Writes exclusively via SECURITY DEFINER RPC — USING(false) blocks all direct client writes.

CREATE TABLE public.collection_audit_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid        NOT NULL,
  user_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type    text        NOT NULL CHECK (event_type IN (
    'created', 'renamed', 'deleted', 'visibility_changed', 'item_added', 'item_removed'
  )),
  context       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collection_audit_events IS
  'Append-only audit trail for collection lifecycle events (create, rename, delete, membership changes). '
  'Writes only via SECURITY DEFINER RPC. '
  'collection_id carries no FK so records survive collection deletion (ADR 0011).';

COMMENT ON COLUMN public.collection_audit_events.collection_id IS
  'UUID of the collection. No FK — intentional: audit records must outlive the entity.';

ALTER TABLE public.collection_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to collection audit events"
  ON public.collection_audit_events FOR ALL USING (false);

CREATE INDEX collection_audit_events_collection_id_idx
  ON public.collection_audit_events (collection_id);
CREATE INDEX collection_audit_events_user_id_idx
  ON public.collection_audit_events (user_id);
CREATE INDEX collection_audit_events_created_at_idx
  ON public.collection_audit_events (created_at DESC);

-- SECURITY DEFINER: auth.uid() resolved at call time — cannot be spoofed by client.
CREATE OR REPLACE FUNCTION public.record_collection_audit_event(
  p_collection_id uuid,
  p_event_type    text,
  p_context       jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.collection_audit_events (collection_id, user_id, event_type, context)
  VALUES (p_collection_id, auth.uid(), p_event_type, p_context);
END;
$$;

REVOKE ALL ON FUNCTION public.record_collection_audit_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_collection_audit_event TO authenticated;

-- Update unified compliance view to include collection audit arm.
-- Full view redefinition required for CREATE OR REPLACE VIEW in Postgres.
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
  FROM public.user_profile_audit_events

  UNION ALL

  -- Collection lifecycle (create, rename, delete, membership changes)
  SELECT
    id,
    'collection_audit_events'::text        AS source_table,
    'collection'::text                     AS entity_type,
    collection_id                          AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.collection_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
