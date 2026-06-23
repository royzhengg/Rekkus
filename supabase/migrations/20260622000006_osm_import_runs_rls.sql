-- osm_import_runs was created without RLS; enable it now
alter table public.osm_import_runs enable row level security;
create policy "Service role manages osm_import_runs"
  on public.osm_import_runs for all using (auth.role() = 'service_role');
