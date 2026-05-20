-- Soft delete enforcement: RPCs, restore functions, RLS fixes, and scheduled purge.
--
-- The deleted_at columns and partial indexes already exist (20240205).
-- This migration wires up enforcement: the columns were previously inert.
--
-- Pattern mirrors delete_message() from 20240211 — SECURITY DEFINER RPCs
-- own the delete path; RLS DELETE policies are removed so hard-delete is
-- impossible from the client.

-- ─── 1a: Owner soft-delete RPCs ──────────────────────────────────────────────

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

create or replace function public.delete_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null then raise exception 'not_authenticated'; end if;
  update public.comments
    set deleted_at = now(), deleted_reason = 'user_deleted'
    where id = p_comment_id and user_id = actor_id and deleted_at is null;
end; $$;

revoke all on function public.delete_post(uuid) from public, anon;
revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_post(uuid) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;

-- ─── 1b: Restore RPCs (service-role / admin only) ────────────────────────────
--
-- Required for moderation_actions.action_type = 'restore_content' to have
-- any effect. No grant to authenticated — callable only via service role.

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

create or replace function public.restore_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comments
    set deleted_at = null, deleted_reason = null
    where id = p_comment_id;
end; $$;

revoke all on function public.restore_post(uuid) from public, anon, authenticated;
revoke all on function public.restore_comment(uuid) from public, anon, authenticated;

-- ─── 1c: Fix RLS — drop ALL policies, re-add SELECT/INSERT/UPDATE only ───────
--
-- The initial schema used FOR ALL policies (SELECT+INSERT+UPDATE+DELETE).
-- Dropping DELETE access forces all deletes through the RPCs above.

-- Posts
drop policy if exists "Anyone can view posts" on public.posts;
drop policy if exists "Users can manage their own posts" on public.posts;

create policy "Anyone can view posts" on public.posts for select
  using (deleted_at is null);
create policy "Users can create posts" on public.posts for insert
  with check (user_id = auth.uid());
create policy "Users can update own posts" on public.posts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Comments
drop policy if exists "Anyone can view comments" on public.comments;
drop policy if exists "Users can manage their own comments" on public.comments;

create policy "Anyone can view comments" on public.comments for select
  using (deleted_at is null);
create policy "Users can create comments" on public.comments for insert
  with check (user_id = auth.uid());
create policy "Users can update own comments" on public.comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Post photos
drop policy if exists "Anyone can view post photos" on public.post_photos;
drop policy if exists "Users can manage photos for their posts" on public.post_photos;

create policy "Anyone can view post photos" on public.post_photos for select
  using (deleted_at is null);
create policy "Users can create post photos" on public.post_photos for insert
  with check (auth.uid() = (select user_id from public.posts where id = post_id));
create policy "Users can update own post photos" on public.post_photos for update
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));

-- ─── 1d: Batched purge function + pg_cron schedule ───────────────────────────
--
-- GDPR Art. 17 requires erasure "without undue delay." 30-day retention is
-- industry standard — content is hidden immediately via RLS, physically removed
-- after 30 days to allow moderation appeals.
--
-- Batched (1000 rows/iteration) to avoid long-running transactions, WAL spikes,
-- and replication lag at scale. The sub-select + DELETE pattern is index-friendly.
--
-- Prerequisite: pg_cron extension must be enabled in Supabase dashboard
-- (Database → Extensions → pg_cron) before this migration runs.

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

revoke all on function public.purge_soft_deleted_content(int) from public, anon, authenticated;

-- Register the daily schedule only if pg_cron is enabled.
-- Enable it in Supabase dashboard → Database → Extensions → pg_cron,
-- then run: select cron.schedule('purge-soft-deleted-content', '0 3 * * *', 'select public.purge_soft_deleted_content()');
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'purge-soft-deleted-content',
      '0 3 * * *',
      'select public.purge_soft_deleted_content()'
    );
  end if;
end; $$;
