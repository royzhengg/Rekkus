-- Domain: RLS / Search
-- Owner: Platform
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.analytics_events enable row level security;
alter table public.search_analytics enable row level security;
alter table public.suburb_aliases enable row level security;
alter table public.suburb_lookups enable row level security;
alter table public.trending_searches enable row level security;
alter table public.saved_searches enable row level security;
alter table public.saved_search_audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- public.analytics_events
-- ---------------------------------------------------------------------------

drop policy if exists "aggregate reads public" on analytics_events;
CREATE POLICY "Aggregate reads public" ON analytics_events
  FOR SELECT USING (true);

drop policy if exists "users insert own events" on analytics_events;
CREATE POLICY "Users insert own events" ON analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- public.search_analytics
-- ---------------------------------------------------------------------------

drop policy if exists "Users read own search_analytics" on public.search_analytics;
create policy "Users read own search_analytics" on public.search_analytics for select using (auth.uid() = user_id);
drop policy if exists "Service role manages search_analytics" on public.search_analytics;
create policy "Service role manages search_analytics" on public.search_analytics for all using (auth.role() = 'service_role');
drop policy if exists "Insert search_analytics" on public.search_analytics;
create policy "Insert search_analytics" on public.search_analytics for insert with check (true);


-- ---------------------------------------------------------------------------
-- public.suburb_aliases + suburb_lookups
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can read suburb_aliases" on public.suburb_aliases;
create policy "Anyone can read suburb_aliases"
  on public.suburb_aliases for select using (true);

drop policy if exists "anyone can read suburb_lookups" on public.suburb_lookups;
create policy "Anyone can read suburb_lookups"
  on public.suburb_lookups for select using (true);


-- ---------------------------------------------------------------------------
-- public.trending_searches
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can read trending_searches" on public.trending_searches;
create policy "Anyone can read trending_searches"
  on public.trending_searches for select using (true);


-- ---------------------------------------------------------------------------
-- public.saved_searches
-- ---------------------------------------------------------------------------

drop policy if exists "users manage own saved searches" on public.saved_searches;
CREATE POLICY "Users manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- public.saved_search_audit_events
-- ---------------------------------------------------------------------------

drop policy if exists "no direct client access to saved search audit events" on public.saved_search_audit_events;
CREATE POLICY "No direct client access to saved search audit events"
  ON public.saved_search_audit_events FOR ALL USING (false);


-- ---------------------------------------------------------------------------
-- public.cuisine_aliases
-- Note: table definition lives in migrations; RLS policies here.
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view cuisine aliases" on public.cuisine_aliases;
create policy "Anyone can view cuisine aliases"
    on public.cuisine_aliases for select
    using (true);


-- ---------------------------------------------------------------------------
-- public.search_synonyms
-- Note: table definition lives in migrations; RLS policies here.
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can read search synonyms" on public.search_synonyms;
create policy "Anyone can read search synonyms"
    on public.search_synonyms for select
    using (true);
