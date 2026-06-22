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

const completeSchema = `
create index places_search_tsv_idx on public.places using gin (to_tsvector('simple', name));
create index posts_search_tsv_idx on public.posts using gin (to_tsvector('simple', caption));
create index users_search_tsv_idx on public.users using gin (to_tsvector('simple', username));
create index dishes_search_tsv_idx on public.dishes using gin (search_tsv);
create function public.search_places_full_text() returns void language sql as $$ select 1 $$;
create function public.search_posts_full_text() returns void language sql as $$ select 1 $$;
create function public.search_posts_by_dish() returns void language sql as $$ select 1 $$;
create function public.search_dishes_full_text() returns void language sql as $$ select 1 $$;
create function public.suggest_searches() returns void language sql as $$ select 1 $$;
create function public.resolve_suburb_query() returns void language sql as $$ select 1 $$;
create table if not exists public.cuisine_aliases (alias text);
create table if not exists public.search_synonyms (term text);
create table if not exists public.suburb_aliases (alias text);
create table if not exists public.hashtags (name text);
create table if not exists public.post_hashtags (post_id uuid);
`

const completeSources = {
  searchDoc: completeSearchDoc,
  schemaSource: completeSchema,
  searchServiceSource: 'CUISINE_SYNONYMS search_synonyms',
  searchPipelineSource: 'SearchCandidate decideSearchProviderFallback',
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

  assert.ok(failures.some((failure) => failure.includes('search_posts_full_text RPC')))
  assert.ok(failures.some((failure) => failure.includes('dishes_search_tsv_idx')))
  assert.ok(failures.some((failure) => failure.includes('suburb_aliases table')))
})

test('search index contract scanner accepts the full contract and evidence set', () => {
  assert.deepEqual(searchIndexContractFailures(completeSources), [])
})
