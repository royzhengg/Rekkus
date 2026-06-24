-- Domain: Functions / Collections
-- Owner: Growth
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- add_saved_target_to_collection
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
  elsif p_target_type = 'place' then
    if not exists (select 1 from public.places p where p.id = p_target_id) then
      raise exception 'place_not_found';
    end if;
    insert into public.saved_places (user_id, place_id)
    values (current_user_id, p_target_id)
    on conflict (user_id, place_id) do nothing;
  else
    raise exception 'invalid_target_type';
  end if;

  insert into public.collection_items (collection_id, target_type, target_id)
  values (p_collection_id, p_target_type, p_target_id)
  on conflict (collection_id, target_type, target_id) do nothing;
end;
$$;

-- unsave_target
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
  elsif p_target_type = 'place' then
    delete from public.saved_places
    where user_id = current_user_id and place_id = p_target_id;
  else
    raise exception 'invalid_target_type';
  end if;
end;
$$;
