-- Domain: RLS / Admin
-- Owner: Platform / Trust & Safety / Compliance
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.user_trust_profiles enable row level security;
alter table public.auth_audit_events enable row level security;
alter table public.content_lifecycle_events enable row level security;
alter table public.dish_audit_events enable row level security;
alter table public.user_profile_audit_events enable row level security;
alter table public.collection_audit_events enable row level security;
alter table public.feature_flag_audit_events enable row level security;
alter table public.feature_flag_overrides enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.place_provider_links   enable row level security;
alter table public.place_audit_events     enable row level security;
alter table public.place_ownership_events enable row level security;

-- ---------------------------------------------------------------------------
-- public.user_blocks
-- ---------------------------------------------------------------------------

drop policy if exists "users can manage their own blocks" on public.user_blocks;
create policy "Users can manage their own blocks" on public.user_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks" on public.user_blocks
  for select using (auth.uid() = blocker_id);


-- ---------------------------------------------------------------------------
-- public.content_reports
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated users can create reports" on public.content_reports;
create policy "Authenticated users can create reports" on public.content_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "users can view their own reports" on public.content_reports;
create policy "Users can view their own reports" on public.content_reports
  for select using (auth.uid() = reporter_id);


-- ---------------------------------------------------------------------------
-- public.moderation_actions
-- ---------------------------------------------------------------------------

drop policy if exists "authenticated users can view moderation actions they reported" on public.moderation_actions;
create policy "Authenticated users can view moderation actions they reported" on public.moderation_actions
  for select using (
    exists (
      select 1 from public.content_reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- public.moderation_appeals
-- ---------------------------------------------------------------------------

drop policy if exists "users can create moderation appeals" on public.moderation_appeals;
create policy "Users can create moderation appeals" on public.moderation_appeals
  for insert with check (auth.uid() = appellant_id);

drop policy if exists "users can view their own moderation appeals" on public.moderation_appeals;
create policy "Users can view their own moderation appeals" on public.moderation_appeals
  for select using (auth.uid() = appellant_id);


-- ---------------------------------------------------------------------------
-- public.user_trust_profiles
-- ---------------------------------------------------------------------------

drop policy if exists "users can view their own trust profile" on public.user_trust_profiles;
create policy "Users can view their own trust profile" on public.user_trust_profiles
  for select using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Audit event tables (append-only; no direct client access)
-- ---------------------------------------------------------------------------

drop policy if exists "no direct client access to auth audit events" on public.auth_audit_events;
CREATE POLICY "No direct client access to auth audit events"
  ON public.auth_audit_events FOR ALL USING (false);

drop policy if exists "no direct client access to content lifecycle events" on public.content_lifecycle_events;
CREATE POLICY "No direct client access to content lifecycle events"
  ON public.content_lifecycle_events FOR ALL USING (false);

drop policy if exists "no direct client access to dish audit events" on public.dish_audit_events;
CREATE POLICY "No direct client access to dish audit events"
  ON public.dish_audit_events FOR ALL USING (false);

drop policy if exists "no direct client access to user profile audit events" on public.user_profile_audit_events;
CREATE POLICY "No direct client access to user profile audit events"
  ON public.user_profile_audit_events FOR ALL USING (false);

drop policy if exists "no direct client access to collection audit events" on public.collection_audit_events;
CREATE POLICY "No direct client access to collection audit events"
  ON public.collection_audit_events FOR ALL USING (false);

drop policy if exists "no direct client access to feature flag audit events" on public.feature_flag_audit_events;
CREATE POLICY "No direct client access to feature flag audit events"
  ON public.feature_flag_audit_events FOR ALL USING (false);


-- ---------------------------------------------------------------------------
-- Governance
-- ---------------------------------------------------------------------------

drop policy if exists "no client feature flag override access" on public.feature_flag_overrides;
CREATE POLICY "No client feature flag override access" ON public.feature_flag_overrides
  FOR ALL
  USING (false)
  WITH CHECK (false);

drop policy if exists "users can submit own privacy requests" on public.privacy_requests;
create policy "Users can submit own privacy requests"
  on public.privacy_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can view own privacy requests" on public.privacy_requests;
create policy "Users can view own privacy requests"
  on public.privacy_requests for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Place audit
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view restaurant aliases" on public.place_provider_links;
drop policy if exists "Anyone can view restaurant aliases" on public.place_provider_links;
create policy "Anyone can view place provider links"
  on public.place_provider_links for select
  using (true);

drop policy if exists "users can submit restaurant alias suggestions" on public.place_provider_links;
drop policy if exists "Users can submit restaurant alias suggestions" on public.place_provider_links;
create policy "Users can submit place provider link suggestions"
  on public.place_provider_links for insert
  to authenticated
  with check (created_by = auth.uid() and status = 'active');

drop policy if exists "authenticated users can view restaurant audit events" on public.place_audit_events;
drop policy if exists "Authenticated users can view restaurant audit events" on public.place_audit_events;
create policy "Authenticated users can view place audit events"
  on public.place_audit_events for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can view restaurant ownership events" on public.place_ownership_events;
drop policy if exists "Authenticated users can view restaurant ownership events" on public.place_ownership_events;
create policy "Authenticated users can view place ownership events"
  on public.place_ownership_events for select
  to authenticated
  using (true);

drop policy if exists "users can submit own restaurant claims" on public.place_ownership_events;
drop policy if exists "Users can submit own restaurant claims" on public.place_ownership_events;
create policy "Users can submit own place claims"
  on public.place_ownership_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and event_type = 'claim_submitted'
    and status = 'pending'
  );


-- ---------------------------------------------------------------------------
-- public.place_merge_events
-- ---------------------------------------------------------------------------
alter table public.place_merge_events enable row level security;

drop policy if exists "authenticated users can view restaurant merge events" on public.place_merge_events;
drop policy if exists "Authenticated users can view restaurant merge events" on public.place_merge_events;
create policy "Authenticated users can view place merge events"
  on public.place_merge_events for select
  to authenticated
  using (true);

drop policy if exists "users can submit duplicate restaurant evidence" on public.place_merge_events;
drop policy if exists "Users can submit duplicate restaurant evidence" on public.place_merge_events;
create policy "Users can submit duplicate place evidence"
  on public.place_merge_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and merged_place_id is null
    and rollback_reference = 'no_merge_performed'
  );


-- ---------------------------------------------------------------------------
-- public.data_repair_events
-- Note: table definition lives in migrations; RLS policies here.
-- ---------------------------------------------------------------------------

drop policy if exists "users can submit own repair reports" on public.data_repair_events;
create policy "Users can submit own repair reports"
  on public.data_repair_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and source_type = 'user_report'
    and status = 'reported'
  );

drop policy if exists "users can view own repair reports" on public.data_repair_events;
create policy "Users can view own repair reports"
  on public.data_repair_events for select
  to authenticated
  using (actor_id = auth.uid());
