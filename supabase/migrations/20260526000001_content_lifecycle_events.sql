-- Compliance-grade post and comment lifecycle audit trail.
-- entity_id has NO foreign key so records survive content deletion.
-- (post_edit_events uses ON DELETE CASCADE — inserting a 'deleted' row there would be wiped by the cascade.)
-- Covers user-initiated and system-initiated creation, deletion, and restoration.

CREATE TABLE public.content_lifecycle_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text        NOT NULL CHECK (entity_type IN ('post', 'comment')),
  entity_id   uuid        NOT NULL,
  user_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  text        NOT NULL CHECK (event_type IN ('created', 'deleted', 'restored')),
  context     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_lifecycle_events IS
  'Append-only audit trail for post and comment creation, deletion, and restoration. '
  'entity_id carries no FK so records survive cascade deletes on the source entity. '
  'Admin-initiated removals are tracked in moderation_actions; this table covers user-initiated lifecycle events.';

COMMENT ON COLUMN public.content_lifecycle_events.entity_id IS
  'UUID of the post or comment. No FK — intentional: audit records must outlive the entity.';

ALTER TABLE public.content_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to content lifecycle events"
  ON public.content_lifecycle_events FOR ALL USING (false);

CREATE INDEX content_lifecycle_events_entity_idx
  ON public.content_lifecycle_events (entity_type, entity_id);
CREATE INDEX content_lifecycle_events_user_id_idx
  ON public.content_lifecycle_events (user_id);
CREATE INDEX content_lifecycle_events_created_at_idx
  ON public.content_lifecycle_events (created_at DESC);

-- SECURITY DEFINER RPC — the only write path from app code.
-- Fires fire-and-forget from service layer; never blocks user-facing operations.
CREATE OR REPLACE FUNCTION public.record_content_lifecycle_event(
  p_entity_type text,
  p_entity_id   uuid,
  p_event_type  text,
  p_context     jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.content_lifecycle_events (entity_type, entity_id, user_id, event_type, context)
  VALUES (p_entity_type, p_entity_id, auth.uid(), p_event_type, p_context);
END;
$$;
