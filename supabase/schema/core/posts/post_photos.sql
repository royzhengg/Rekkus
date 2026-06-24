-- Domain: Core
-- Owner: Content
-- Classification: Entity
-- Lifecycle: Core
-- Source of Truth: Yes

-- post_embeddings
create table if not exists public.post_embeddings (
  post_id         uuid        primary key references public.posts(id) on delete cascade,
  embedding       extensions.vector(384) not null,
  embedding_hash  text
);

-- post_photos
create table if not exists public.post_photos (
  id                uuid        default gen_random_uuid() primary key,
  post_id           uuid        references public.posts on delete cascade not null,
  url               text        not null,
  order_index       integer     not null default 0,
  media_type        text        not null default 'image',
  original_url      text,
  processed_url     text,
  thumbnail_url     text,
  mime_type         text,
  size_bytes        bigint,
  duration_ms       integer,
  width             integer,
  height            integer,
  processing_status text        not null default 'ready',
  processing_error  text,
  is_cover          boolean     not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- Indexes
create index if not exists post_embeddings_hnsw on public.post_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists post_photos_processing_status_idx on public.post_photos (processing_status);
