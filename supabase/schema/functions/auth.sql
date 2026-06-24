-- Domain: Functions / Auth
-- Owner: Platform
-- Classification: Audit
-- Lifecycle: Core
-- Source of Truth: Yes

-- auth_audit_log_trigger
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

-- handle_new_auth_user
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (new.id, 'u_' || left(replace(new.id::text, '-', ''), 8))
  on conflict (id) do nothing;

  insert into public.user_settings (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- delete_own_account
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

-- record_auth_audit_event
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

-- record_auth_audit_event_server
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

-- record_collection_audit_event
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

-- record_content_lifecycle_event
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

-- record_profile_audit_event
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

-- record_place_provider_snapshot
create or replace function public.record_place_provider_snapshot(
  p_place_id uuid,
  p_source_type text,
  p_source_id text,
  p_field_mask text[],
  p_normalized_payload jsonb,
  p_attribution_required boolean,
  p_attribution_text text,
  p_cacheability text,
  p_retention_policy text,
  p_stale_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'authenticated role required';
  end if;

  if p_place_id is null or p_source_type is null or p_source_id is null then
    raise exception 'place_id, source_type, and source_id are required';
  end if;

  insert into public.place_provenance (
    place_id,
    source_type,
    source_id,
    source_rights,
    attribution_required,
    cacheability,
    retention_policy,
    confidence,
    created_by,
    updated_at
  )
  values (
    p_place_id,
    p_source_type,
    p_source_id,
    case when p_source_type = 'google_places' then 'provider_google' else 'source_terms_defined' end,
    p_attribution_required,
    p_cacheability,
    p_retention_policy,
    0.70,
    auth.uid(),
    now()
  )
  on conflict (source_type, source_id)
  do update set
    place_id = excluded.place_id,
    attribution_required = excluded.attribution_required,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    updated_at = now();

  insert into public.place_provider_cache (
    place_id,
    source_type,
    source_id,
    field_mask,
    normalized_payload,
    attribution_required,
    attribution_text,
    cacheability,
    retention_policy,
    freshness_state,
    fetched_at,
    stale_at,
    updated_at
  )
  values (
    p_place_id,
    p_source_type,
    p_source_id,
    p_field_mask,
    coalesce(p_normalized_payload, '{}'::jsonb),
    p_attribution_required,
    p_attribution_text,
    p_cacheability,
    p_retention_policy,
    'fresh',
    now(),
    p_stale_at,
    now()
  )
  on conflict (source_type, source_id)
  do update set
    place_id = excluded.place_id,
    field_mask = excluded.field_mask,
    normalized_payload = excluded.normalized_payload,
    attribution_required = excluded.attribution_required,
    attribution_text = excluded.attribution_text,
    cacheability = excluded.cacheability,
    retention_policy = excluded.retention_policy,
    freshness_state = 'fresh',
    fetched_at = now(),
    stale_at = excluded.stale_at,
    updated_at = now();

  insert into public.place_audit_events (
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    place_id,
    source_type,
    reason,
    after_summary,
    compliance_category
  )
  values (
    'user',
    auth.uid(),
    'provider_snapshot_recorded',
    'place_provider_cache',
    p_place_id,
    p_place_id,
    p_source_type,
    'provider_fallback_or_location_selection',
    jsonb_build_object('source_id', p_source_id, 'field_mask', p_field_mask),
    'provider_data'
  );
end;
$$;

-- purge_soft_deleted_content
create or replace function public.purge_soft_deleted_content(batch_size int default 1000)
returns int language plpgsql security definer set search_path = public as $$
declare
  total_purged int := 0;
  rows_deleted  int;
begin
  -- Photos first — FK child of posts
  loop
    delete from public.post_photos
      where id in (
        select id from public.post_photos
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  loop
    delete from public.comments
      where id in (
        select id from public.comments
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  loop
    delete from public.posts
      where id in (
        select id from public.posts
        where deleted_at is not null
          and deleted_at < now() - interval '30 days'
        limit batch_size
      );
    get diagnostics rows_deleted = row_count;
    total_purged := total_purged + rows_deleted;
    exit when rows_deleted < batch_size;
    perform pg_sleep(0.1);
  end loop;

  return total_purged;
end; $$;

-- delete_post
create or replace function public.delete_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  -- Wrong post_id or not owner = silent no-op (no information leak)
  update public.posts
    set deleted_at = now(), deleted_reason = 'user_deleted'
    where id = p_post_id and user_id = actor_id and deleted_at is null;
  -- Cascade to photos — post owner owns all photos on the post
  update public.post_photos
    set deleted_at = now()
    where post_id = p_post_id and deleted_at is null;
end; $$;

-- delete_comment
create or replace function public.delete_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  update public.comments
    set deleted_at = now(), deleted_reason = 'user_deleted'
    where id = p_comment_id and user_id = actor_id and deleted_at is null;
end; $$;

-- delete_message
create or replace function public.delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.messages
  set
    deleted_at = now(),
    body = null,
    attachment_url = null,
    attachment_metadata = null
  where id = p_message_id
    and sender_id = actor_id
    and deleted_at is null;
end;
$$;

-- restore_comment
create or replace function public.restore_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comments
    set deleted_at = null, deleted_reason = null
    where id = p_comment_id;
end; $$;

-- restore_post
create or replace function public.restore_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.posts
    set deleted_at = null, deleted_reason = null
    where id = p_post_id;
  update public.post_photos
    set deleted_at = null
    where post_id = p_post_id;
end; $$;

-- ---------------------------------------------------------------------------
-- AUTH TRIGGERS
-- ---------------------------------------------------------------------------

drop trigger if exists auth_audit_delete_trigger on public.auth;
CREATE TRIGGER auth_audit_delete_trigger
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

drop trigger if exists auth_audit_login_trigger on public.auth;
CREATE TRIGGER auth_audit_login_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auth_audit_log_trigger();

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------

revoke all on function public.delete_post(uuid) from public, anon;
grant execute on function public.delete_post(uuid) to authenticated;

revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

revoke all on function public.purge_soft_deleted_content(int) from public, anon, authenticated;

revoke all on function public.restore_post(uuid) from public, anon, authenticated;
revoke all on function public.restore_comment(uuid) from public, anon, authenticated;

revoke all on function public.record_auth_audit_event from public;
grant execute on function public.record_auth_audit_event(text, jsonb) to authenticated;

revoke all on function public.record_content_lifecycle_event from public;
grant execute on function public.record_content_lifecycle_event(text, uuid, text, jsonb) to authenticated;

revoke all on function public.record_profile_audit_event from public;
grant execute on function public.record_profile_audit_event(text, jsonb) to authenticated;

revoke all on function public.record_collection_audit_event from public;
grant execute on function public.record_collection_audit_event(uuid, text, jsonb) to authenticated;

revoke all on function public.add_saved_target_to_collection(uuid, text, uuid) from public;
grant execute on function public.add_saved_target_to_collection(uuid, text, uuid) to authenticated;

revoke all on function public.unsave_target(text, uuid, boolean) from public;
grant execute on function public.unsave_target(text, uuid, boolean) to authenticated;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- cron: purge soft-deleted content daily at 3am UTC
-- Enable pg_cron in Supabase dashboard → Database → Extensions, then run:
-- select cron.schedule('purge-soft-deleted-content', '0 3 * * *', 'select public.purge_soft_deleted_content()');
