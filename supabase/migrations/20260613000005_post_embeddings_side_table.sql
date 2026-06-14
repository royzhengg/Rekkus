-- Extract embedding + embedding_hash out of posts into a dedicated side-table.
-- posts is a high-write hot table; vector columns are large (384 dims × 4 bytes = 1.5 kB
-- per row) and only used by semantic-search code paths. Removing them from posts:
--   - shrinks the posts heap page, improving cache hit rate on high-frequency reads
--   - lets the HNSW index sit on a smaller, purpose-built table
--   - mirrors the restaurant_provider_cache pattern already in use for restaurants
--
-- The embed-content Edge Function and match_embeddings() function are updated in the
-- same deployment to write/read from post_embeddings instead of posts.

create table if not exists public.post_embeddings (
  post_id         uuid        primary key references public.posts(id) on delete cascade,
  embedding       extensions.vector(384) not null,
  embedding_hash  text
);

-- Migrate existing embeddings before dropping the source columns.
insert into public.post_embeddings (post_id, embedding, embedding_hash)
  select id, embedding, embedding_hash
  from public.posts
  where embedding is not null
on conflict (post_id) do nothing;

-- Move the HNSW index to the new table (the old one is dropped below).
drop index if exists public.posts_embedding_idx;

create index if not exists post_embeddings_hnsw
  on public.post_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- RLS: same visibility as posts (anyone authenticated can view).
alter table public.post_embeddings enable row level security;

drop policy if exists "anyone authenticated can view post embeddings" on public.post_embeddings;
create policy "anyone authenticated can view post embeddings"
  on public.post_embeddings for select
  using (auth.role() = 'authenticated');

-- Drop the now-migrated columns from posts.
alter table public.posts
  drop column if exists embedding,
  drop column if exists embedding_hash;

-- Update match_embeddings() to join post_embeddings for the 'post' branch.
create or replace function public.match_embeddings(
  query_embedding extensions.vector(384),
  match_type text,
  match_count integer default 10,
  similarity_threshold real default 0.65
)
returns table (id uuid, similarity real)
language plpgsql stable as $$
begin
  if match_type = 'post' then
    return query
      select p.id, (1 - (pe.embedding <=> query_embedding))::real as similarity
      from public.posts p
      join public.post_embeddings pe on pe.post_id = p.id
      where p.deleted_at is null
        and (1 - (pe.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  elsif match_type = 'restaurant' then
    return query
      select r.id, (1 - (r.embedding <=> query_embedding))::real as similarity
      from public.restaurants r
      where r.embedding is not null
        and (1 - (r.embedding <=> query_embedding)) > similarity_threshold
      order by similarity desc
      limit match_count;
  end if;
end;
$$;
