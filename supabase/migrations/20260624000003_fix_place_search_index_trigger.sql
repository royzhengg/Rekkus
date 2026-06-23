-- Fix: trg_refresh_place_search_index was applied to remote with `new.place_id`
-- unconditionally. Use IF/ELSE instead of CASE so PL/pgSQL short-circuits and
-- never evaluates new.place_id when the trigger fires from the `places` table.

create or replace function public.trg_refresh_place_search_index()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'places' then
    perform public.refresh_place_search_index(new.id);
  else
    perform public.refresh_place_search_index(new.place_id);
  end if;
  return null;
end;
$$;
