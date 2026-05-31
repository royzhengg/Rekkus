-- B-546: Add cached follower_count and post_count to users for people search ranking
-- These columns are backfilled and kept in sync via triggers so searchUsers() can
-- fetch them in a single O(1) select rather than counting joins at query time.

alter table public.users
  add column if not exists follower_count integer not null default 0,
  add column if not exists post_count    integer not null default 0;

-- Backfill from current data
update public.users u
set
  follower_count = (
    select count(*) from public.follows f where f.following_id = u.id
  ),
  post_count = (
    select count(*) from public.posts p where p.user_id = u.id and p.deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- Trigger: maintain follower_count on follows insert / delete
-- ---------------------------------------------------------------------------
create or replace function public.trg_users_follower_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.users set follower_count = follower_count + 1 where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.users set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_follows_update_follower_count on public.follows;
create trigger trg_follows_update_follower_count
  after insert or delete on public.follows
  for each row execute function public.trg_users_follower_count();

-- ---------------------------------------------------------------------------
-- Trigger: maintain post_count on posts insert / delete / soft-delete
-- ---------------------------------------------------------------------------
create or replace function public.trg_users_post_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.users set post_count = post_count + 1 where id = new.user_id;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.users set post_count = greatest(0, post_count - 1) where id = old.user_id;
  elsif tg_op = 'UPDATE' then
    -- soft-delete: deleted_at went from null → non-null
    if old.deleted_at is null and new.deleted_at is not null then
      update public.users set post_count = greatest(0, post_count - 1) where id = new.user_id;
    -- un-delete: deleted_at went from non-null → null
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.users set post_count = post_count + 1 where id = new.user_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_posts_update_post_count on public.posts;
create trigger trg_posts_update_post_count
  after insert or delete or update of deleted_at on public.posts
  for each row execute function public.trg_users_post_count();
