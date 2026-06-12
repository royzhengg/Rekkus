-- B-553: account-scoped saved searches with audit coverage.

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  query            text        NOT NULL,
  normalized_query text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_searches_query_not_blank CHECK (length(trim(query)) > 1),
  CONSTRAINT saved_searches_normalized_query_not_blank CHECK (length(trim(normalized_query)) > 1),
  CONSTRAINT saved_searches_user_normalized_unique UNIQUE (user_id, normalized_query)
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved searches" ON public.saved_searches;
CREATE POLICY "Users manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_searches_user_created_idx
  ON public.saved_searches (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_search_audit_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid        NOT NULL,
  user_id         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type      text        NOT NULL CHECK (event_type IN (
    'saved_search_created', 'saved_search_updated', 'saved_search_removed'
  )),
  context         jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_search_audit_events IS
  'Append-only audit trail for saved search mutations. '
  'Written automatically by a fail-closed trigger on saved_searches. '
  'Context stores operational metadata only and does not store raw query text.';

ALTER TABLE public.saved_search_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to saved search audit events"
  ON public.saved_search_audit_events;
CREATE POLICY "No direct client access to saved search audit events"
  ON public.saved_search_audit_events FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS saved_search_audit_events_saved_search_idx
  ON public.saved_search_audit_events (saved_search_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_search_audit_events_user_id_idx
  ON public.saved_search_audit_events (user_id);
CREATE INDEX IF NOT EXISTS saved_search_audit_events_created_at_idx
  ON public.saved_search_audit_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.saved_search_audit_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'saved_search_created';
    INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
    VALUES (
      NEW.id,
      NEW.user_id,
      v_event_type,
      jsonb_build_object('operation', TG_OP, 'source', 'database_trigger')
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_event_type := 'saved_search_updated';
    INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
    VALUES (
      NEW.id,
      NEW.user_id,
      v_event_type,
      jsonb_build_object(
        'operation', TG_OP,
        'source', 'database_trigger',
        'query_changed', OLD.normalized_query IS DISTINCT FROM NEW.normalized_query
      )
    );
    RETURN NEW;
  END IF;

  v_event_type := 'saved_search_removed';
  INSERT INTO public.saved_search_audit_events (saved_search_id, user_id, event_type, context)
  VALUES (
    OLD.id,
    OLD.user_id,
    v_event_type,
    jsonb_build_object('operation', TG_OP, 'source', 'database_trigger')
  );
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.saved_search_audit_trigger FROM PUBLIC;

DROP TRIGGER IF EXISTS saved_searches_audit_trigger ON public.saved_searches;
CREATE TRIGGER saved_searches_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.saved_search_audit_trigger();

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
  FROM public.saved_search_audit_events;

COMMENT ON VIEW public.platform_audit_events_view IS
  'Unified compliance read surface. Query via service-role for incident investigation and compliance evidence. '
  'To extend: add a UNION ALL arm from the new *_audit_events table mapping to '
  '(id, source_table, entity_type, entity_id, user_id, event_type, context, created_at) '
  'in the same migration as the new table. The check:audit guardrail enforces view completeness.';
