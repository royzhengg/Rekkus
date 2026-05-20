create table if not exists public.post_drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  title text not null default '',
  body text not null default '',
  selected_place jsonb,
  restaurant_id uuid references public.restaurants on delete set null,
  dish_tags jsonb not null default '[]'::jsonb,
  food_rating integer not null default 0,
  vibe_rating integer not null default 0,
  cost_rating integer not null default 0,
  taste_verdict text,
  value_verdict text,
  occasion_tags text[] not null default '{}',
  best_dish text not null default '',
  cuisine_type text not null default '',
  hashtags text[] not null default '{}',
  hashtag_input text not null default '',
  status text not null default 'autosave',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_at timestamptz
);

alter table public.post_drafts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_status_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_status_check
      check (status in ('autosave', 'saved', 'discarded', 'published'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_food_rating_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_food_rating_check
      check (food_rating between 0 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_vibe_rating_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_vibe_rating_check
      check (vibe_rating between 0 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_cost_rating_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_cost_rating_check
      check (cost_rating between 0 and 4);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_taste_verdict_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_taste_verdict_check
      check (taste_verdict is null or taste_verdict in ('not_for_me', 'good', 'craveable', 'must_order', 'worth_a_trip'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_drafts_value_verdict_check'
  ) then
    alter table public.post_drafts
      add constraint post_drafts_value_verdict_check
      check (value_verdict is null or value_verdict in ('not_worth_it', 'fair', 'great_value', 'worth_the_splurge'));
  end if;
end $$;

create table if not exists public.post_draft_media (
  id uuid default gen_random_uuid() primary key,
  draft_id uuid references public.post_drafts on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  local_id text not null,
  media_type text not null,
  storage_path text not null,
  public_preview_url text,
  thumbnail_url text,
  mime_type text,
  size_bytes bigint,
  duration_ms integer,
  width integer,
  height integer,
  processing_status text not null default 'ready',
  processing_error text,
  order_index integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.post_draft_media enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'post_draft_media_media_type_check'
  ) then
    alter table public.post_draft_media
      add constraint post_draft_media_media_type_check
      check (media_type in ('image', 'video'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_draft_media_processing_status_check'
  ) then
    alter table public.post_draft_media
      add constraint post_draft_media_processing_status_check
      check (processing_status in ('local_ready', 'queued', 'uploading', 'uploaded', 'processing', 'ready', 'failed'));
  end if;
end $$;

create index if not exists post_drafts_user_status_updated_idx
  on public.post_drafts (user_id, status, updated_at desc);

create index if not exists post_draft_media_draft_order_idx
  on public.post_draft_media (draft_id, order_index);

drop policy if exists "Users can manage their own post drafts" on public.post_drafts;
create policy "Users can manage their own post drafts" on public.post_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own post draft media" on public.post_draft_media;
create policy "Users can manage their own post draft media" on public.post_draft_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('post-drafts', 'post-drafts', false)
on conflict do nothing;

drop policy if exists "Users can read their own post draft objects" on storage.objects;
create policy "Users can read their own post draft objects" on storage.objects
  for select using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload their own post draft objects" on storage.objects;
create policy "Users can upload their own post draft objects" on storage.objects
  for insert with check (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own post draft objects" on storage.objects;
create policy "Users can update their own post draft objects" on storage.objects
  for update using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own post draft objects" on storage.objects;
create policy "Users can delete their own post draft objects" on storage.objects
  for delete using (
    bucket_id = 'post-drafts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
