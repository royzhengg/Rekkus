-- Domain: RLS / Core
-- Owner: Platform
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.places enable row level security;
alter table public.posts enable row level security;
alter table public.post_embeddings enable row level security;
alter table public.post_photos enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.user_settings enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_drafts enable row level security;
alter table public.post_draft_media enable row level security;
alter table public.post_edit_events enable row level security;
alter table public.dishes enable row level security;
alter table public.saved_dishes enable row level security;
alter table public.place_contact enable row level security;
alter table public.place_features enable row level security;
alter table public.place_provider_metadata enable row level security;
alter table public.place_stats enable row level security;
alter table public.place_aliases enable row level security;
alter table public.place_traits enable row level security;
alter table public.place_merge_log enable row level security;
alter table public.place_sources enable row level security;
alter table public.place_opening_hours enable row level security;

-- ---------------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------------

drop policy if exists "users can manage their own profile" on public.users;
create policy "Users can manage their own profile" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users can view all profiles" on public.users;
create policy "Users can view all profiles" on public.users for select using (true);


-- public.user_settings
drop policy if exists "users can manage their own settings" on public.user_settings;
create policy "Users can manage their own settings" on public.user_settings for all
  using (auth.uid() = id) with check (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- public.places
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view places" on public.places;
create policy "Anyone can view places" on public.places for select using (true);

drop policy if exists "authenticated users can insert places" on public.places;
create policy "Authenticated users can insert places" on public.places for insert with check (auth.role() = 'authenticated');

drop policy if exists "authenticated users can update places" on public.places;
create policy "Authenticated users can update places"
  on public.places for update
  using (auth.role() = 'authenticated');

drop policy if exists "users can view own created place provenance" on public.places;
create policy "Users can view own created place provenance"
  on public.places for select
  to authenticated
  using (created_by = auth.uid());


-- public.place_contact
drop policy if exists "Public read place_contact" on public.place_contact;
create policy "Public read place_contact" on public.place_contact for select using (true);
drop policy if exists "Service role manages place_contact" on public.place_contact;
create policy "Service role manages place_contact" on public.place_contact for all using (auth.role() = 'service_role');

-- public.place_features
drop policy if exists "Public read place_features" on public.place_features;
create policy "Public read place_features" on public.place_features for select using (true);
drop policy if exists "Service role manages place_features" on public.place_features;
create policy "Service role manages place_features" on public.place_features for all using (auth.role() = 'service_role');

-- public.place_provider_metadata
drop policy if exists "Public read place_provider_metadata" on public.place_provider_metadata;
create policy "Public read place_provider_metadata" on public.place_provider_metadata for select using (true);
drop policy if exists "Service role manages place_provider_metadata" on public.place_provider_metadata;
create policy "Service role manages place_provider_metadata" on public.place_provider_metadata for all using (auth.role() = 'service_role');

-- public.place_stats
drop policy if exists "Public read place_stats" on public.place_stats;
create policy "Public read place_stats" on public.place_stats for select using (true);
drop policy if exists "Service role manages place_stats" on public.place_stats;
create policy "Service role manages place_stats" on public.place_stats for all using (auth.role() = 'service_role');

-- public.place_aliases
drop policy if exists "Public read place_aliases" on public.place_aliases;
create policy "Public read place_aliases" on public.place_aliases for select using (true);
drop policy if exists "Service role manages place_aliases" on public.place_aliases;
create policy "Service role manages place_aliases" on public.place_aliases for all using (auth.role() = 'service_role');

-- public.place_traits
drop policy if exists "Public read place_traits" on public.place_traits;
create policy "Public read place_traits" on public.place_traits for select using (true);
drop policy if exists "Service role manages place_traits" on public.place_traits;
create policy "Service role manages place_traits" on public.place_traits for all using (auth.role() = 'service_role');

-- public.place_merge_log
drop policy if exists "Service role manages place_merge_log" on public.place_merge_log;
create policy "Service role manages place_merge_log" on public.place_merge_log for all using (auth.role() = 'service_role');

-- public.place_sources
drop policy if exists "Service role manages place_sources" on public.place_sources;
create policy "Service role manages place_sources" on public.place_sources for all using (auth.role() = 'service_role');

-- public.place_opening_hours
drop policy if exists "Public read place_opening_hours" on public.place_opening_hours;
create policy "Public read place_opening_hours" on public.place_opening_hours for select using (true);
drop policy if exists "Service role manages place_opening_hours" on public.place_opening_hours;
create policy "Service role manages place_opening_hours" on public.place_opening_hours for all using (auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- public.dishes + saved_dishes
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view dishes" on public.dishes;
CREATE POLICY "Anyone can view dishes"
  ON public.dishes FOR SELECT USING (true);

drop policy if exists "authenticated users can insert dishes" on public.dishes;
CREATE POLICY "Authenticated users can insert dishes"
  ON public.dishes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

drop policy if exists "users manage own saved dishes" on public.saved_dishes;
create policy "Users manage own saved dishes"
  on public.saved_dishes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- public.posts
-- ---------------------------------------------------------------------------

drop policy if exists "anyone can view posts" on public.posts;
create policy "Anyone can view posts" on public.posts for select
  using (deleted_at is null);

drop policy if exists "users can create posts" on public.posts;
create policy "Users can create posts" on public.posts for insert
  with check (user_id = auth.uid());

drop policy if exists "users can manage their own posts" on public.posts;
create policy "Users can manage their own posts" on public.posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can update own posts" on public.posts;
create policy "Users can update own posts" on public.posts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- public.post_embeddings
drop policy if exists "anyone authenticated can view post embeddings" on public.post_embeddings;
create policy "anyone authenticated can view post embeddings"
  on public.post_embeddings for select
  using (auth.role() = 'authenticated');


-- public.post_photos
drop policy if exists "anyone can view post photos" on public.post_photos;
create policy "Anyone can view post photos" on public.post_photos for select
  using (deleted_at is null);

drop policy if exists "users can create post photos" on public.post_photos;
create policy "Users can create post photos" on public.post_photos for insert
  with check (auth.uid() = (select user_id from public.posts where id = post_id));

drop policy if exists "users can manage photos for their posts" on public.post_photos;
create policy "Users can manage photos for their posts" on public.post_photos for all
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));

drop policy if exists "users can update own post photos" on public.post_photos;
create policy "Users can update own post photos" on public.post_photos for update
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));


-- public.post_hashtags
drop policy if exists "anyone can view post hashtags" on public.post_hashtags;
create policy "Anyone can view post hashtags" on public.post_hashtags for select using (true);

drop policy if exists "users can manage hashtags for their posts" on public.post_hashtags;
create policy "Users can manage hashtags for their posts" on public.post_hashtags for all
  using (auth.uid() = (select user_id from public.posts where id = post_id))
  with check (auth.uid() = (select user_id from public.posts where id = post_id));


-- public.hashtags
drop policy if exists "anyone can view hashtags" on public.hashtags;
create policy "Anyone can view hashtags" on public.hashtags for select using (true);

drop policy if exists "authenticated users can insert hashtags" on public.hashtags;
create policy "Authenticated users can insert hashtags" on public.hashtags for insert with check (auth.role() = 'authenticated');


-- public.likes
drop policy if exists "anyone can view likes" on public.likes;
create policy "Anyone can view likes" on public.likes for select using (true);

drop policy if exists "users can manage their own likes" on public.likes;
create policy "Users can manage their own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.saves
drop policy if exists "users can manage their own saves" on public.saves;
create policy "Users can manage their own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can view their own saves" on public.saves;
create policy "Users can view their own saves" on public.saves for select using (auth.uid() = user_id);


-- public.comments
drop policy if exists "anyone can view comments" on public.comments;
create policy "Anyone can view comments" on public.comments for select
  using (deleted_at is null);

drop policy if exists "users can create comments" on public.comments;
create policy "Users can create comments" on public.comments for insert
  with check (user_id = auth.uid());

drop policy if exists "users can manage their own comments" on public.comments;
create policy "Users can manage their own comments" on public.comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can update own comments" on public.comments;
create policy "Users can update own comments" on public.comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- public.post_reactions
drop policy if exists "anyone can view reactions" on public.post_reactions;
CREATE POLICY "Anyone can view reactions" ON public.post_reactions
  FOR SELECT USING (true);

drop policy if exists "users can delete own reactions" on public.post_reactions;
CREATE POLICY "Users can delete own reactions" ON public.post_reactions
  FOR DELETE USING (auth.uid() = user_id);

drop policy if exists "users can insert own reactions" on public.post_reactions;
CREATE POLICY "Users can insert own reactions" ON public.post_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- public.post_drafts
drop policy if exists "users can manage their own post drafts" on public.post_drafts;
create policy "Users can manage their own post drafts" on public.post_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.post_draft_media
drop policy if exists "users can manage their own post draft media" on public.post_draft_media;
create policy "Users can manage their own post draft media" on public.post_draft_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- public.post_edit_events
drop policy if exists "users can create their own post edit events" on public.post_edit_events;
create policy "Users can create their own post edit events"
  on public.post_edit_events
  for insert
  with check (
    auth.uid() = user_id
    and auth.uid() = (
      select p.user_id
      from public.posts p
      where p.id = post_id
    )
  );

drop policy if exists "users can view their own post edit events" on public.post_edit_events;
create policy "Users can view their own post edit events"
  on public.post_edit_events
  for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- public.place_owners
-- ---------------------------------------------------------------------------
alter table public.place_owners enable row level security;

drop policy if exists "Owners can view their own place claims" on public.place_owners;
create policy "Owners can view their own place claims"
  on public.place_owners for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Users can submit place claims" on public.place_owners;
create policy "Users can submit place claims"
  on public.place_owners for insert
  to authenticated
  with check (owner_id = auth.uid() and status = 'pending');
