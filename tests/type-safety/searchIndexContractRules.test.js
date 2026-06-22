const assert = require('node:assert/strict')
const test = require('node:test')
const { searchIndexContractFailures } = require('../../scripts/lib/search-index-contract-rules')

const completeSearchDoc = `
## Searchable Field Contract
Restaurants / places
Dishes
Posts
People / users
Hashtags / tags
Areas / suburbs
Tokenization
Prefix
Hashtag
Dish tag
Alias
Re-indexing
Owner process
provider fallback
`

// B-509: schema now requires HNSW indexes + search_semantic RPC instead of FTS indexes
const completeSchema = `
create index post_embeddings_hnsw on public.post_embeddings using hnsw (embedding vector_cosine_ops);
create index dish_embeddings_hnsw on public.dish_embeddings using hnsw (embedding vector_cosine_ops);
create function public.search_semantic(query_embedding vector) returns void language sql as $$ select 1 $$;
create function public.suggest_searches() returns void language sql as $$ select 1 $$;
create function public.resolve_suburb_query() returns void language sql as $$ select 1 $$;
create table if not exists public.search_synonyms (term text);
create table if not exists public.suburb_aliases (alias text);
create table if not exists public.hashtags (name text);
create table if not exists public.post_hashtags (post_id uuid);
`

const completeSources = {
  searchDoc: completeSearchDoc,
  schemaSource: completeSchema,
  searchServiceSource: 'searchSemantic embedQuery',
  searchPipelineSource: '',
  restaurantServiceSource: 'search_places_full_text near_lat',
}

test('search index contract scanner rejects incomplete product contract docs', () => {
  const failures = searchIndexContractFailures({
    ...completeSources,
    searchDoc: '## Search Index Governance\nlocal-first provider fallback',
  })

  assert.ok(failures.some((failure) => failure.includes('Searchable Field Contract')))
  assert.ok(failures.some((failure) => failure.includes('hashtags/tags contract')))
  assert.ok(failures.some((failure) => failure.includes('re-indexing ownership')))
})

test('search index contract scanner rejects missing DB and RPC evidence', () => {
  const failures = searchIndexContractFailures({
    ...completeSources,
    schemaSource: 'create index restaurants_search_tsv_idx on public.restaurants using gin (to_tsvector(\'simple\', name));',
  })

  assert.ok(failures.some((failure) => failure.includes('post_embeddings HNSW index')))
  assert.ok(failures.some((failure) => failure.includes('dish_embeddings HNSW index')))
  assert.ok(failures.some((failure) => failure.includes('search_semantic RPC')))
  assert.ok(failures.some((failure) => failure.includes('suburb_aliases table')))
})

test('search index contract scanner accepts the full contract and evidence set', () => {
  assert.deepEqual(searchIndexContractFailures(completeSources), [])
})
