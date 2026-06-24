-- Domain: RLS / Provider
-- Owner: Platform / Data
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.place_provenance       enable row level security;
alter table public.place_provider_cache   enable row level security;
alter table public.place_observations     enable row level security;
alter table public.osm_import_runs        enable row level security;

-- ---------------------------------------------------------------------------
-- public.place_provenance
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view restaurant sources" on public.place_provenance;
drop policy if exists "Anyone can view restaurant sources" on public.place_provenance;
create policy "Anyone can view place provenance"
  on public.place_provenance for select
  using (true);

drop policy if exists "authenticated users can propose restaurant sources" on public.place_provenance;
drop policy if exists "Authenticated users can propose restaurant sources" on public.place_provenance;
create policy "Authenticated users can propose place provenance"
  on public.place_provenance for insert
  to authenticated
  with check (created_by = auth.uid() and source_type in ('user_created', 'owner_submitted'));


-- ---------------------------------------------------------------------------
-- public.place_provider_cache
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view restaurant provider cache" on public.place_provider_cache;
drop policy if exists "Anyone can view restaurant provider cache" on public.place_provider_cache;
create policy "Anyone can view place provider cache"
  on public.place_provider_cache for select
  using (true);


-- ---------------------------------------------------------------------------
-- public.place_observations
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view trusted restaurant observations" on public.place_observations;
drop policy if exists "Anyone can view trusted restaurant observations" on public.place_observations;
create policy "Anyone can view trusted place observations"
  on public.place_observations for select
  using (status = 'trusted' or user_id = auth.uid());

drop policy if exists "users can create own restaurant observations" on public.place_observations;
drop policy if exists "Users can create own restaurant observations" on public.place_observations;
create policy "Users can create own place observations"
  on public.place_observations for insert
  to authenticated
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- public.place_popularity_cache
-- Note: table definition lives in migrations; RLS policies here.
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view place popularity cache" on public.place_popularity_cache;
create policy "Anyone can view place popularity cache"
  on public.place_popularity_cache for select using (true);
