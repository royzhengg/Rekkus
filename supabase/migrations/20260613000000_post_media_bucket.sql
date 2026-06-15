insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true);

create policy "Users can upload post media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public post media read"
  on storage.objects for select to public
  using (bucket_id = 'post-media');

create policy "Users can delete own post media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
