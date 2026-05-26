-- B-519: Server-side auth audit guarantee via PostgreSQL trigger on auth.users.
-- Client-side recordAuthAuditEvent calls are retained as belt-and-suspenders.
-- Duplicate records (trigger + client) are acceptable in an append-only audit log.
--
-- Capturable server-side: login_email_success, login_oauth_success, password_changed, account_deleted
-- Client-only (intentional): logout — session invalidation does not update auth.users rows.

-- Server-side insert function: accepts explicit user_id because trigger context has no auth.uid().
-- REVOKE from PUBLIC so clients cannot call this directly; use record_auth_audit_event for client writes.
CREATE OR REPLACE FUNCTION public.record_auth_audit_event_server(
  p_user_id   uuid,
  p_event_type text,
  p_context    jsonb DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN (
    'login_email_success', 'login_oauth_success', 'logout', 'password_changed', 'account_deleted'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.auth_audit_events (user_id, event_type, context)
  VALUES (
    -- Resolve via subquery: returns NULL if public profile not yet created (e.g. mid-registration),
    -- avoiding FK violation while still recording the event.
    (SELECT id FROM public.users WHERE id = p_user_id),
    p_event_type,
    p_context
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_auth_audit_event_server FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_auth_audit_event_server TO service_role;
-- postgres (superuser) has implicit access; no explicit GRANT needed for trigger context.

-- Trigger function: fires on auth.users INSERT/UPDATE (AFTER) and DELETE (BEFORE).
-- Each insert is wrapped in an exception handler so audit failures never block auth operations.
CREATE OR REPLACE FUNCTION public.auth_audit_log_trigger()
RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_provider  text;
  v_event     text;
  v_user_id   uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- BEFORE DELETE: capture account_deleted before cascade removes public.users row.
    -- ON DELETE SET NULL on auth_audit_events.user_id will NULL it out post-cascade — correct per ADR 0011.
    BEGIN
      PERFORM public.record_auth_audit_event_server(OLD.id, 'account_deleted', NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE path
  v_user_id := NEW.id;
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at) THEN
    v_event := CASE WHEN v_provider = 'email' THEN 'login_email_success' ELSE 'login_oauth_success' END;
    BEGIN
      PERFORM public.record_auth_audit_event_server(
        v_user_id, v_event, jsonb_build_object('provider', v_provider, 'source', 'server')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    BEGIN
      PERFORM public.record_auth_audit_event_server(
        v_user_id, 'password_changed', jsonb_build_object('source', 'server')
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Login and password-change trigger (AFTER so the auth row is fully committed before we read it).
CREATE TRIGGER auth_audit_login_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

-- Account deletion trigger (BEFORE so public.users FK target still exists when we insert).
CREATE TRIGGER auth_audit_delete_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

-- Update table comment: server-side guarantee is now implemented.
COMMENT ON TABLE public.auth_audit_events IS
  'ISO A.12.4.1 auth audit trail. Append-only. '
  'Server-side guarantee: triggers on auth.users INSERT/UPDATE/DELETE (B-519). '
  'Client-side calls in AuthContext are belt-and-suspenders; duplicate records are acceptable. '
  'logout is client-only (session invalidation does not update auth.users rows). '
  'Context: sanitised provider metadata only — never email, credentials, tokens, or IP. '
  'IP/device metadata deferred to B-520 (requires privacy review).';
