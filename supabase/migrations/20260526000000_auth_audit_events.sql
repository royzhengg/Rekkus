-- ISO 27001 A.12.4.1-compliant authentication audit trail.
-- Append-only (no UPDATE/DELETE policies). No retention job touches this table.
-- Context is sanitised — never stores email, password, tokens, or IP address.
-- Failed login attempts stay in analytics_events (no user_id to associate pre-session).

CREATE TABLE public.auth_audit_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  text        NOT NULL CHECK (event_type IN (
    'login_email_success',
    'login_oauth_success',
    'logout',
    'password_changed',
    'account_deleted'
  )),
  context     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_audit_events IS
  'ISO A.12.4.1 auth audit trail. Append-only. Context: sanitised provider metadata only — never email, credentials, tokens, or IP. '
  'IP/device metadata deferred to B-520 (requires privacy review). '
  'Server-side guarantee via Supabase auth hook deferred to B-519.';

ALTER TABLE public.auth_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to auth audit events"
  ON public.auth_audit_events FOR ALL USING (false);

CREATE INDEX auth_audit_events_user_id_idx    ON public.auth_audit_events (user_id);
CREATE INDEX auth_audit_events_created_at_idx ON public.auth_audit_events (created_at DESC);
CREATE INDEX auth_audit_events_event_type_idx ON public.auth_audit_events (event_type, created_at DESC);

-- SECURITY DEFINER so AuthContext can write records without the client bypassing the USING(false) policy.
-- auth.uid() is resolved at call time, so user_id is always the authenticated caller.
CREATE OR REPLACE FUNCTION public.record_auth_audit_event(
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_audit_events (user_id, event_type, context)
  VALUES (auth.uid(), p_event_type, p_context);
END;
$$;
