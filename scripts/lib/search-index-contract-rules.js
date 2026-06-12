const SEARCH_DOC_TERMS = [
  ['Searchable Field Contract', /Searchable Field Contract/i],
  ['restaurants/places contract', /Restaurants \/ places/i],
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
  ['restaurants_search_tsv_idx', /restaurants_search_tsv_idx/i],
  ['posts_search_tsv_idx', /posts_search_tsv_idx/i],
  ['users_search_tsv_idx', /users_search_tsv_idx/i],
  ['dishes_search_tsv_idx', /dishes_search_tsv_idx/i],
  ['search_restaurants_full_text RPC', /function\s+(?:public\.)?search_restaurants_full_text\b/i],
  ['search_posts_full_text RPC', /function\s+(?:public\.)?search_posts_full_text\b/i],
  ['search_posts_by_dish RPC', /function\s+(?:public\.)?search_posts_by_dish\b/i],
  ['search_dishes_full_text RPC', /function\s+(?:public\.)?search_dishes_full_text\b/i],
  ['suggest_searches RPC', /function\s+(?:public\.)?suggest_searches\b/i],
  ['resolve_suburb_query RPC', /function\s+(?:public\.)?resolve_suburb_query\b/i],
  ['cuisine_aliases table', /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?cuisine_aliases\b/i],
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

  if (!/CUISINE_SYNONYMS/.test(searchServiceSource) || !/search_synonyms/.test(searchServiceSource)) {
    failures.push('lib/services/search.ts must retain deterministic cuisine/search synonym ownership.')
  }

  if (!/SearchCandidate/.test(searchPipelineSource) || !/decideSearchProviderFallback/.test(searchPipelineSource)) {
    failures.push('lib/search/pipeline.ts must retain unified candidate retrieval and provider fallback ownership.')
  }

  if (!/search_restaurants_full_text/.test(restaurantServiceSource) || !/near_lat/.test(restaurantServiceSource)) {
    failures.push('lib/services/restaurants.ts must retain restaurant FTS and geo-ranked RPC ownership.')
  }

  return failures
}

module.exports = { searchIndexContractFailures }
