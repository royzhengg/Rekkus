-- user_top_spots audit table
-- Compliance gap: user_top_spots was created in 20260612000000 without an audit trail.
-- Mutable user-owned entity (up to 3 curated place picks per user); changes need an
-- append-only record for abuse investigation and ISO A.12.4 compliance evidence.
-- Writes exclusively via SECURITY DEFINER RPC — USING(false) blocks all direct client writes.

CREATE TABLE public.user_top_spots_audit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  place_id   uuid,                        -- no FK: record must survive place deletion
  position   smallint,                    -- null when removing all spots
  event_type text        NOT NULL CHECK (event_type IN ('top_spot_set', 'top_spot_removed', 'top_spot_reordered')),
  context    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_top_spots_audit_events IS
  'ISO A.12.4 audit trail for user top-spot changes. Append-only. '
  'user_id uses ON DELETE SET NULL so records survive account deletion. '
  'place_id has no FK so records survive place deletion.';

COMMENT ON COLUMN public.user_top_spots_audit_events.user_id IS
  'User whose top spots changed. ON DELETE SET NULL — record must outlive the account.';

COMMENT ON COLUMN public.user_top_spots_audit_events.place_id IS
  'Place involved in the change. No FK — record must outlive the place.';

ALTER TABLE public.user_top_spots_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_client_access_top_spots_audit"
  ON public.user_top_spots_audit_events FOR ALL USING (false);

CREATE INDEX user_top_spots_audit_events_user_id_idx
  ON public.user_top_spots_audit_events (user_id);
CREATE INDEX user_top_spots_audit_events_created_at_idx
  ON public.user_top_spots_audit_events (created_at DESC);

-- SECURITY DEFINER: auth.uid() resolved at call time — caller cannot spoof user_id.
CREATE OR REPLACE FUNCTION public.record_top_spot_audit_event(
  p_event_type text,
  p_place_id   uuid    DEFAULT NULL,
  p_position   smallint DEFAULT NULL,
  p_context    jsonb   DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_top_spots_audit_events (user_id, place_id, position, event_type, context)
  VALUES (auth.uid(), p_place_id, p_position, p_event_type, p_context);
END;
$$;

REVOKE ALL ON FUNCTION public.record_top_spot_audit_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_top_spot_audit_event TO authenticated;

-- Extend unified compliance view with user_top_spots_audit_events arm.
-- Extensibility contract: add a UNION ALL arm here whenever a new *_audit_events table is created.
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
  FROM public.feature_flag_audit_events

  UNION ALL

  SELECT
    id,
    'saved_search_audit_events'::text      AS source_table,
    'saved_search'::text                   AS entity_type,
    saved_search_id                        AS entity_id,
    user_id,
    event_type,
    context,
    created_at
  FROM public.saved_search_audit_events

  UNION ALL

  SELECT
    id,
    'user_top_spots_audit_events'::text    AS source_table,
    'user_top_spot'::text                  AS entity_type,
    place_id                               AS entity_id,
    user_id,
    event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'place_id', place_id,
      'position', position
    )) || COALESCE(context, '{}'::jsonb)   AS context,
    created_at
  FROM public.user_top_spots_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
