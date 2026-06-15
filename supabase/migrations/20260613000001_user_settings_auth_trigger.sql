-- Ensure every auth user has an owner-scoped settings row.
-- The original trigger created public.users skeleton rows only, so first-time
-- settings writes could be lost when update-only persistence found no row.

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

insert into public.user_settings (id)
select au.id
from auth.users au
where not exists (
  select 1
  from public.user_settings us
  where us.id = au.id
)
on conflict (id) do nothing;
