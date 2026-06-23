-- Fix: trg_refresh_place_search_index was applied to remote with `new.place_id`
-- unconditionally before the CASE fix landed. Replace the function body so the
-- trigger works correctly when fired from the `places` table (which has `new.id`)
-- vs `place_stats` (which has `new.place_id`).

create or replace function public.trg_refresh_place_search_index()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_place_search_index(
    case tg_table_name when 'places' then new.id else new.place_id end
  );
  return null;
end;
$$;
