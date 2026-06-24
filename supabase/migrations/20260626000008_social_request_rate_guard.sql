-- B-629 follow-up: ensure local databases that applied an earlier B-629 draft
-- receive the same follow-request rate guard as the final foundation migration.

create or replace function public.request_follow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  is_private boolean;
  request_id uuid;
  target_follow_id uuid;
  correlation uuid := gen_random_uuid();
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_target_id is null or actor_id = p_target_id then
    raise exception 'invalid_follow_target';
  end if;
  if public.has_user_block_between(actor_id, p_target_id) then
    raise exception 'follow_blocked';
  end if;

  if (
    select count(*)
    from public.follow_requests
    where requester_id = actor_id
      and created_at >= now() - interval '1 hour'
  ) >= 30 then
    raise exception 'follow_request_rate_limited';
  end if;

  if (
    select count(*)
    from public.follow_requests
    where requester_id = actor_id
      and created_at >= now() - interval '1 day'
  ) >= 200 then
    raise exception 'follow_request_rate_limited';
  end if;

  if exists (
    select 1 from public.follows
    where follower_id = actor_id and following_id = p_target_id
  ) then
    return 'following';
  end if;

  select coalesce(us.private_account, false)
  into is_private
  from public.users u
  left join public.user_settings us on us.id = u.id
  where u.id = p_target_id;

  if not found then
    raise exception 'follow_target_not_found';
  end if;

  if not is_private then
    insert into public.follows (follower_id, following_id)
    values (actor_id, p_target_id)
    on conflict (follower_id, following_id) do nothing
    returning id into target_follow_id;

    update public.follow_requests
    set status = 'cancelled',
        updated_at = now(),
        resolved_at = now(),
        correlation_id = correlation
    where requester_id = actor_id
      and target_id = p_target_id
      and status = 'pending';

    return 'following';
  end if;

  select id into request_id
  from public.follow_requests
  where requester_id = actor_id
    and target_id = p_target_id
    and status = 'pending'
  limit 1;

  if request_id is null then
    insert into public.follow_requests (requester_id, target_id, correlation_id)
    values (actor_id, p_target_id, correlation)
    returning id into request_id;

    perform public.record_follow_request_audit_event(
      request_id, actor_id, p_target_id, actor_id, 'requested',
      jsonb_build_object('correlation_id', correlation)
    );
  end if;

  perform public.create_social_event(
    actor_id, p_target_id, 'follow_request_pending', 'follow_request', request_id,
    'follow_request', request_id, 'user', correlation, '{}'::jsonb, now()
  );

  return 'requested';
end;
$$;
