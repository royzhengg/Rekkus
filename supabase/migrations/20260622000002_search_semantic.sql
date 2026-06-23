-- Vector search redesign: unified semantic search RPC.
--
-- search_semantic fetches top candidates from places, post_embeddings, and
-- dish_embeddings via HNSW ANN scan (fast), then blends semantic similarity
-- with a taste vector computed from the user's saves if p_user_id is provided.
--
-- Taste blending: final_score = 0.7 * semantic_similarity + 0.3 * taste_similarity
-- When p_user_id is null: final_score = semantic_similarity
--
-- Returns up to p_limit rows ordered by final_score DESC.

-- ---------------------------------------------------------------------------
-- search_semantic
-- ---------------------------------------------------------------------------

create or replace function public.search_semantic(
  query_embedding extensions.vector(384),
  p_user_id       uuid    default null,
  p_limit         integer default 50
)
returns table (
  entity_type        text,
  entity_id          uuid,
  semantic_similarity real,
  final_score        real,
  display_data       jsonb
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_taste_vector extensions.vector(384);
begin
  -- Compute taste vector from user's recent saves (top 20 per entity type)
  if p_user_id is not null then
    select avg(e)::extensions.vector(384) into v_taste_vector
    from (
      (
        select p.embedding as e
        from public.saved_places sp
        join public.places p on p.id = sp.place_id
        where sp.user_id = p_user_id and p.embedding is not null
        order by sp.created_at desc
        limit 20
      )
      union all
      (
        select pe.embedding
        from public.saves s
        join public.post_embeddings pe on pe.post_id = s.post_id
        where s.user_id = p_user_id
        order by s.created_at desc
        limit 20
      )
      union all
      (
        select de.embedding
        from public.dish_embeddings de
        join public.saved_dishes sd on sd.dish_id = de.dish_id
        where sd.user_id = p_user_id
        order by sd.created_at desc
        limit 20
      )
    ) user_embeddings;
  end if;

  return query
  with place_candidates as (
    select
      'place'::text                                                         as entity_type,
      p.id                                                                  as entity_id,
      p.embedding                                                           as embedding,
      jsonb_build_object(
        'name',               p.name,
        'address',            p.address,
        'city',               p.city,
        'suburb',             p.suburb,
        'cuisine_type',       p.cuisine_type,
        'google_place_id',    p.google_place_id,
        'latitude',           p.latitude,
        'longitude',          p.longitude,
        'google_rating',      p.google_rating,
        'google_review_count',p.google_review_count,
        'open_now',           p.open_now
      )                                                                     as display_data
    from public.places p
    where p.embedding is not null
    order by p.embedding <=> query_embedding
    limit 20
  ),
  post_candidates as (
    select
      'post'::text                                                          as entity_type,
      pe.post_id                                                            as entity_id,
      pe.embedding                                                          as embedding,
      jsonb_build_object('post_id', pe.post_id)                            as display_data
    from public.post_embeddings pe
    join public.posts po on po.id = pe.post_id and po.deleted_at is null
    order by pe.embedding <=> query_embedding
    limit 20
  ),
  dish_candidates as (
    select
      'dish'::text                                                          as entity_type,
      de.dish_id                                                            as entity_id,
      de.embedding                                                          as embedding,
      jsonb_build_object(
        'name',         d.name,
        'cuisine_type', d.cuisine_type,
        'top_photo_url', (
          select coalesce(pp.processed_url, pp.thumbnail_url)
          from public.posts po2
          join public.post_photos pp on pp.post_id = po2.id and pp.deleted_at is null
          where po2.dish_id = d.id
            and po2.deleted_at is null
            and pp.media_type = 'image'
          order by po2.created_at desc
          limit 1
        ),
        'save_count', (select count(*) from public.saved_dishes sd2 where sd2.dish_id = d.id),
        'post_count', (select count(*) from public.posts po3 where po3.dish_id = d.id and po3.deleted_at is null)
      )                                                                     as display_data
    from public.dish_embeddings de
    join public.dishes d on d.id = de.dish_id
    order by de.embedding <=> query_embedding
    limit 20
  ),
  all_candidates as (
    select * from place_candidates
    union all
    select * from post_candidates
    union all
    select * from dish_candidates
  )
  select
    c.entity_type,
    c.entity_id,
    (1 - (c.embedding <=> query_embedding))::real                          as semantic_similarity,
    case
      when v_taste_vector is not null then
        (0.7 * (1 - (c.embedding <=> query_embedding))
         + 0.3 * (1 - (c.embedding <=> v_taste_vector)))::real
      else
        (1 - (c.embedding <=> query_embedding))::real
    end                                                                     as final_score,
    c.display_data
  from all_candidates c
  where (1 - (c.embedding <=> query_embedding)) > 0.4
  order by final_score desc
  limit p_limit;
end;
$$;

grant execute on function public.search_semantic(extensions.vector, uuid, integer)
  to authenticated, anon;
