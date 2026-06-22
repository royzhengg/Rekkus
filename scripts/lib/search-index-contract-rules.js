// B-509 refactor: FTS pipeline replaced by vector search (search_semantic RPC + HNSW indexes).
// This contract now guards the vector search infrastructure instead of FTS RPCs.

const SEARCH_DOC_TERMS = [
  ['Searchable Field Contract', /Searchable Field Contract/i],
  ['restaurants/places contract', /Restaurants \/ places|\bPlaces\b/i],
  ['dishes contract', /\bDishes\b/i],
  ['posts contract', /\bPosts\b/i],
  ['people/users contract', /People \/ users/i],
  ['hashtags/tags contract', /Hashtags \/ tags/i],
  ['areas/suburbs contract', /Areas \/ suburbs/i],
  ['tokenization ownership', /Tokenization/i],
  ['prefix handling', /Prefix/i],
  ['hashtag handling', /Hashtag/i],
  ['dish tag handling', /Dish tag/i],
  ['alias ownership', /Alias/i],
  ['re-indexing ownership', /Re-indexing/i],
  ['owner process', /Owner process/i],
  ['provider fallback ownership', /provider fallback/i],
]

const SCHEMA_EVIDENCE = [
  // Vector search infrastructure (replaces FTS indexes)
  ['post_embeddings HNSW index', /post_embeddings_hnsw/i],
  ['dish_embeddings HNSW index', /dish_embeddings_hnsw/i],
  ['search_semantic RPC', /function\s+(?:public\.)?search_semantic\b/i],
  // Typeahead infrastructure (unchanged)
  ['suggest_searches RPC', /function\s+(?:public\.)?suggest_searches\b/i],
  ['resolve_suburb_query RPC', /function\s+(?:public\.)?resolve_suburb_query\b/i],
  // Supporting tables (unchanged)
  ['search_synonyms table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?search_synonyms\b/i],
  ['suburb_aliases table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?suburb_aliases\b/i],
  ['hashtags table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?hashtags\b/i],
  ['post_hashtags table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?post_hashtags\b/i],
]

function missing(source, entries, scope) {
  const text = source ?? ''
  return entries
    .filter(([, pattern]) => !pattern.test(text))
    .map(([label]) => `${scope} is missing ${label}.`)
}

function searchIndexContractFailures({
  searchDoc = '',
  schemaSource = '',
  searchServiceSource = '',
  searchPipelineSource = '',
  restaurantServiceSource = '',
} = {}) {
  const failures = [
    ...missing(searchDoc, SEARCH_DOC_TERMS, 'product/SEARCH.md searchable-field contract'),
    ...missing(schemaSource, SCHEMA_EVIDENCE, 'Supabase search infrastructure'),
  ]

  // B-509: semantic search replaces cuisine synonyms + FTS
  if (!/searchSemantic/.test(searchServiceSource) || !/embedQuery/.test(searchServiceSource)) {
    failures.push('lib/services/search.ts must retain vector search ownership (searchSemantic + embedQuery).')
  }

  // usePlaceSearch.ts retains provider fallback for place tagging (create-post flow)
  if (!/search_places_full_text/.test(restaurantServiceSource) || !/near_lat/.test(restaurantServiceSource)) {
    failures.push('lib/services/places.ts must retain place FTS and geo-ranked RPC ownership.')
  }

  return failures
}

module.exports = { searchIndexContractFailures }
