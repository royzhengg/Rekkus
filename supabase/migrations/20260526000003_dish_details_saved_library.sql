-- B-283: canonical dish bookmarks, mixed collections, and deterministic post backfill.

create table if not exists public.saved_dishes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  dish_id uuid references public.dishes(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dish_id)
);

alter table public.saved_dishes enable row level security;

drop policy if exists "Users manage own saved dishes" on public.saved_dishes;
create policy "Users manage own saved dishes"
  on public.saved_dishes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists saved_dishes_user_created_idx
  on public.saved_dishes (user_id, created_at desc);
create index if not exists saved_dishes_dish_idx
  on public.saved_dishes (dish_id);

alter table public.collection_items
  drop constraint if exists collection_items_target_type_check;
alter table public.collection_items
  add constraint collection_items_target_type_check
  check (target_type in ('restaurant', 'post', 'dish'));

with candidates as (
  select
    min(trim(p.best_dish)) as dish_name,
    lower(trim(p.best_dish)) as normalized_name,
    p.restaurant_id,
    min(p.cuisine_type) as cuisine_type
  from public.posts p
  where p.dish_id is null
    and p.restaurant_id is not null
    and trim(coalesce(p.best_dish, '')) <> ''
    and p.deleted_at is null
  group by lower(trim(p.best_dish)), p.restaurant_id
),
inserted as (
  insert into public.dishes (name, restaurant_id, cuisine_type)
  select dish_name, restaurant_id, cuisine_type
  from candidates
  on conflict (name_normalized, restaurant_id) do nothing
  returning id
)
insert into public.dish_audit_events (dish_id, event_type, context)
select
  id,
  'created',
  jsonb_build_object('source', 'best_dish_backfill', 'backlog_id', 'B-283')
from inserted;

update public.posts p
set dish_id = d.id
from public.dishes d
where p.dish_id is null
  and p.restaurant_id is not null
  and p.deleted_at is null
  and trim(coalesce(p.best_dish, '')) <> ''
  and d.restaurant_id = p.restaurant_id
  and d.name_normalized = lower(trim(p.best_dish));

create or replace function public.add_saved_target_to_collection(
  p_collection_id uuid,
  p_target_type text,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.collections c
    where c.id = p_collection_id and c.user_id = current_user_id
  ) then
    raise exception 'collection_not_owned';
  end if;

  if p_target_type = 'dish' then
    if not exists (select 1 from public.dishes d where d.id = p_target_id) then
      raise exception 'dish_not_found';
    end if;
    insert into public.saved_dishes (user_id, dish_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, dish_id) do nothing;
  elsif p_target_type = 'post' then
    if not exists (select 1 from public.posts p where p.id = p_target_id and p.deleted_at is null) then
      raise exception 'post_not_found';
    end if;
    insert into public.saves (user_id, post_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, post_id) do nothing;
  elsif p_target_type = 'restaurant' then
    if not exists (select 1 from public.restaurants r where r.id = p_target_id) then
      raise exception 'restaurant_not_found';
    end if;
    insert into public.saved_locations (user_id, restaurant_id, save_status)
    values (current_user_id, p_target_id, 'want_to_try')
    on conflict (user_id, restaurant_id) do nothing;
  else
    raise exception 'invalid_target_type';
  end if;

  insert into public.collection_items (collection_id, target_type, target_id)
  values (p_collection_id, p_target_type, p_target_id)
  on conflict (collection_id, target_type, target_id) do nothing;
end;
$$;

create or replace function public.unsave_target(
  p_target_type text,
  p_target_id uuid,
  p_remove_collection_memberships boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  has_memberships boolean;
begin
  if current_user_id is null then
    raise exception 'authentication_required';
  end if;

  select exists (
    select 1
    from public.collection_items ci
    join public.collections c on c.id = ci.collection_id
    where c.user_id = current_user_id
      and ci.target_type = p_target_type
      and ci.target_id = p_target_id
  ) into has_memberships;

  if has_memberships and not p_remove_collection_memberships then
    raise exception 'target_in_collections';
  end if;

  if p_remove_collection_memberships then
    delete from public.collection_items ci
    using public.collections c
    where ci.collection_id = c.id
      and c.user_id = current_user_id
      and ci.target_type = p_target_type
      and ci.target_id = p_target_id;
  end if;

  if p_target_type = 'dish' then
    delete from public.saved_dishes
    where user_id = current_user_id and dish_id = p_target_id;
  elsif p_target_type = 'post' then
    delete from public.saves
    where user_id = current_user_id and post_id = p_target_id;
  elsif p_target_type = 'restaurant' then
    delete from public.saved_locations
    where user_id = current_user_id and restaurant_id = p_target_id;
  else
    raise exception 'invalid_target_type';
  end if;
end;
$$;

revoke all on function public.add_saved_target_to_collection(uuid, text, uuid) from public;
revoke all on function public.unsave_target(text, uuid, boolean) from public;
grant execute on function public.add_saved_target_to_collection(uuid, text, uuid) to authenticated;
grant execute on function public.unsave_target(text, uuid, boolean) to authenticated;
