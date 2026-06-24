-- Domain: Functions / Audit
-- Owner: Platform / Compliance
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

-- saved_search_audit_trigger
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

-- feature_flag_audit_trigger
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

-- ---------------------------------------------------------------------------
-- SAVED SEARCHES / FEATURE FLAG TRIGGERS
-- ---------------------------------------------------------------------------

drop trigger if exists saved_searches_audit_trigger on public.saved_searches;
CREATE TRIGGER saved_searches_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.saved_search_audit_trigger();

drop trigger if exists feature_flag_override_audit_trigger on public.feature_flag_overrides;
CREATE TRIGGER feature_flag_override_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.feature_flag_audit_trigger();

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------

revoke execute on function public.feature_flag_audit_trigger from public;
revoke execute on function public.saved_search_audit_trigger from public;
