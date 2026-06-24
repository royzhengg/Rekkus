-- Domain: RLS / Storage
-- Owner: Platform
-- Classification: Governance
-- Lifecycle: Core
-- Source of Truth: Yes

-- ---------------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('post-drafts', 'post-drafts', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- storage.objects RLS policies
-- ---------------------------------------------------------------------------

-- avatars
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- post-drafts (private)
drop policy if exists "Users can read their own post draft objects" on storage.objects;
create policy "Users can read their own post draft objects" on storage.objects
  for select using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can upload their own post draft objects" on storage.objects;
create policy "Users can upload their own post draft objects" on storage.objects
  for insert with check (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own post draft objects" on storage.objects;
create policy "Users can update their own post draft objects" on storage.objects
  for update using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own post draft objects" on storage.objects;
create policy "Users can delete their own post draft objects" on storage.objects
  for delete using (bucket_id = 'post-drafts' and auth.uid()::text = (storage.foldername(name))[1]);

-- post-media (public)
drop policy if exists "Public post media read" on storage.objects;
create policy "Public post media read" on storage.objects for select to public
  using (bucket_id = 'post-media');

drop policy if exists "Users can upload post media" on storage.objects;
create policy "Users can upload post media" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own post media" on storage.objects;
create policy "Users can delete own post media" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
