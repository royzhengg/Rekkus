alter table public.post_photos
  add column if not exists media_type text not null default 'image',
  add column if not exists original_url text,
  add column if not exists processed_url text,
  add column if not exists thumbnail_url text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists duration_ms integer,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists processing_status text not null default 'ready',
  add column if not exists processing_error text;

alter table public.posts
  add column if not exists taste_verdict text,
  add column if not exists value_verdict text,
  add column if not exists occasion_tags text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'post_photos_media_type_check'
  ) then
    alter table public.post_photos
      add constraint post_photos_media_type_check
      check (media_type in ('image', 'video'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'post_photos_processing_status_check'
  ) then
    alter table public.post_photos
      add constraint post_photos_processing_status_check
      check (processing_status in ('local_ready', 'queued', 'uploading', 'uploaded', 'processing', 'ready', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'posts_taste_verdict_check'
  ) then
    alter table public.posts
      add constraint posts_taste_verdict_check
      check (taste_verdict is null or taste_verdict in ('not_for_me', 'good', 'craveable', 'must_order', 'worth_a_trip'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'posts_value_verdict_check'
  ) then
    alter table public.posts
      add constraint posts_value_verdict_check
      check (value_verdict is null or value_verdict in ('not_worth_it', 'fair', 'great_value', 'worth_the_splurge'));
  end if;
end $$;

create index if not exists post_photos_processing_status_idx
  on public.post_photos (processing_status);

create index if not exists posts_taste_verdict_idx
  on public.posts (taste_verdict);

create index if not exists posts_value_verdict_idx
  on public.posts (value_verdict);
