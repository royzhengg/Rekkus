-- Auto-create a public.users skeleton row whenever a new auth.users row is inserted.
--
-- Without this, users who sign up via Google OAuth (or any path that bypasses
-- the in-app updateProfile call) have no public.users row. posts.user_id has a
-- FK to public.users, so their very first post insert fails with a FK violation
-- that surfaces as "Could not publish post".
--
-- username is NOT NULL UNIQUE, so skeleton rows use 'u_<first8ofuuid>' as a
-- unique placeholder. updateProfile() in AuthContext overwrites this on profile setup.

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
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Backfill: create skeleton rows for any existing auth.users that have no
-- public.users entry. Covers accounts created before this migration runs.
insert into public.users (id, username)
select
  au.id,
  'u_' || left(replace(au.id::text, '-', ''), 8)
from auth.users au
where au.id not in (select id from public.users)
on conflict (id) do nothing;
