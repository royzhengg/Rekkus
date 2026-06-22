-- Auto-embed places on INSERT via pg_net → embed-content Edge Function.
--
-- Why a trigger not a client-side call: embedding fires for every insert path
-- (OSM import, user-created places, owner onboarding) without each caller
-- needing to remember to invoke the Edge Function.
--
-- Architecture:
--   pg_net (async HTTP) → embed-content Edge Function → places.embedding
--   Fire-and-forget: trigger never blocks the INSERT or causes it to fail.
--   Failures: visible in extensions.net._http_response; retry via admin:embed-places.
--
-- Config: supabase_url is public. service_role_key lives in app_config table
-- (service_role-only access). Insert the key once via admin:seed-embed-config.

create extension if not exists pg_net schema extensions;

-- Config table: one row per setting, service_role access only
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

do $$ begin
  create policy "Service role manages app_config"
    on public.app_config for all using (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

-- Seed the Supabase project URL (public; safe to store in migration)
insert into public.app_config (key, value)
values ('supabase_url', 'https://scwvlqwolfduaalbemzz.supabase.co')
on conflict (key) do update set value = excluded.value;

-- Trigger function
create or replace function public.trigger_embed_place()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url  text;
  v_key  text;
  v_text text;
begin
  v_text := trim(concat_ws(' ', NEW.name, NEW.cuisine_type, NEW.suburb, NEW.city));
  if v_text = '' then return NEW; end if;

  select value into v_url from public.app_config where key = 'supabase_url';
  select value into v_key from public.app_config where key = 'service_role_key';

  if v_url is null or v_key is null then return NEW; end if;

  perform extensions.net.http_post(
    url     := v_url || '/functions/v1/embed-content',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'places',
      'record', jsonb_build_object(
        'id',           NEW.id,
        'name',         NEW.name,
        'cuisine_type', NEW.cuisine_type,
        'suburb',       NEW.suburb,
        'city',         NEW.city
      )
    )
  );

  return NEW;
end;
$$;

drop trigger if exists embed_place_on_insert on public.places;

create trigger embed_place_on_insert
  after insert on public.places
  for each row
  when (NEW.embedding is null)
  execute procedure public.trigger_embed_place();
