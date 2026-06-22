-- Ensure is_cover column exists (remote DBs set up via dump may be missing it).
alter table public.post_photos add column if not exists is_cover boolean not null default false;

-- Backfill cover media for fixed local seed posts.
-- Existing databases already have the posts from 20240102000000_seed_mock_data.sql,
-- but that seed did not create post_photos rows, so Saved/Profile/Feed thumbnails
-- had no DB media to render.
insert into public.post_photos (
  post_id,
  url,
  original_url,
  processed_url,
  thumbnail_url,
  media_type,
  processing_status,
  order_index,
  is_cover
)
select
  seed.post_id,
  seed.url,
  seed.url,
  seed.url,
  seed.url,
  'image',
  'ready',
  0,
  true
from (
  values
    ('11000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&h=600&fit=crop&auto=format'),
    ('11000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=1050&fit=crop&auto=format'),
    ('11000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=1050&fit=crop&auto=format'),
    ('11000000-0000-0000-0000-000000000004'::uuid, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop&auto=format'),
    ('11000000-0000-0000-0000-000000000005'::uuid, 'https://images.unsplash.com/photo-1617196034183-421b4040d733?w=800&h=600&fit=crop&auto=format'),
    ('11000000-0000-0000-0000-000000000006'::uuid, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=1050&fit=crop&auto=format')
) as seed(post_id, url)
where exists (
  select 1
  from public.posts p
  where p.id = seed.post_id
)
and not exists (
  select 1
  from public.post_photos pp
  where pp.post_id = seed.post_id
    and pp.deleted_at is null
);
