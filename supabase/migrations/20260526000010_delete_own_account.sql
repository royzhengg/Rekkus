-- B-522: Self-service account deletion RPC with pre-deletion content lifecycle audit.
-- auth_audit_delete_trigger (migration 006) handles account_deleted in auth_audit_events.
-- This function's job: bulk-audit live owned posts BEFORE the cascade fires.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Bulk-insert lifecycle events for all live posts before cascade removes them.
  -- content_lifecycle_events.user_id is ON DELETE SET NULL — capture it now.
  -- Soft-deleted posts (deleted_at IS NOT NULL) already have a lifecycle event — skip.
  INSERT INTO public.content_lifecycle_events (entity_type, entity_id, user_id, event_type, context)
  SELECT 'post', id, v_user_id, 'deleted',
         jsonb_build_object('reason', 'account_deleted')
  FROM public.posts
  WHERE user_id = v_user_id
    AND deleted_at IS NULL;

  -- Delete the auth row. Fires:
  --   1. auth_audit_delete_trigger (BEFORE DELETE) → writes account_deleted to auth_audit_events
  --   2. CASCADE: auth.users → public.users → public.posts (and all ON DELETE CASCADE children)
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
