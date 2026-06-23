#!/usr/bin/env node
const { printResult, readSchemaSource } = require('./lib/policy-checks')
const { exists, readText } = require('./lib/files')
const { searchIndexContractFailures } = require('../lib/search-index-contract-rules')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []

function requireTerms(file, terms, mode = 'warning') {
  if (!exists(file)) {
    failures.push(`${file} is required for search governance checks.`)
    return
  }

  const source = readText(file)
  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(term, 'i')
    if (!pattern.test(source)) {
      const label = term instanceof RegExp ? term.source : term
      const message = `${file} must include search governance coverage for "${label}".`
      if (mode === 'failure') failures.push(message)
      else warnings.push(message)
    }
  }
}

requireTerms(
  'product/SEARCH.md',
  [
    'Search Index Operations',
    'report-only',
    'Refresh cadence',
    'Stale handling',
    'Ranking recalculation',
    'Search cache rules',
    'Precomputed search signals',
    'Cuisine taxonomy governance',
    'Tuning log',
  ],
  'failure',
)

// B-509 refactor: pipeline.ts replaced by vector search (search_semantic RPC + HNSW indexes).
// useSearch.ts now calls embedQuery + searchSemantic. analytics.search() still fires on every query.
const searchHook = exists('lib/hooks/useSearch.ts') ? readText('lib/hooks/useSearch.ts') : ''
for (const token of ['analytics.search', 'embedQuery', 'searchSemantic']) {
  if (!searchHook.includes(token)) failures.push(`lib/hooks/useSearch.ts must retain ${token} search evidence.`)
}

// B-509: search_semantic RPC replaces old FTS pipeline. Cuisine synonyms now live in DB (search_synonyms table).
// searchTextFallback is required as fallback when embeddings are not yet backfilled.
const searchService = exists('lib/services/search.ts') ? readText('lib/services/search.ts') : ''
for (const token of [
  'searchSemantic',
  'embedQuery',
  'search_semantic',
  'searchTextFallback',
]) {
  if (!searchService.includes(token)) failures.push(`lib/services/search.ts must retain ${token} search evidence.`)
}

const googlePlaces = exists('lib/services/googlePlaces.ts') ? readText('lib/services/googlePlaces.ts') : ''
for (const token of ['CACHE_TTL_MS', 'MIN_AUTOCOMPLETE_LENGTH', 'inflight']) {
  if (!googlePlaces.includes(token)) warnings.push(`lib/services/googlePlaces.ts should retain ${token} cache guardrail.`)
}

const schema = readSchemaSource()
if (!/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?search_semantic\b/i.test(schema)) {
  failures.push('Supabase migrations must define public.search_semantic for vector search.')
}
if (!/dish_embeddings_hnsw/i.test(schema)) {
  failures.push('Supabase migrations must define dish_embeddings_hnsw HNSW index for semantic dish search.')
}

// B-585 / B-509: require quality and generated test files
// quality.test.ts now tests semantic search score thresholds and blended ranking.
if (!exists('tests/unit/lib/search/quality.test.ts')) {
  failures.push(
    'tests/unit/lib/search/quality.test.ts is required for search quality governance. ' +
    'Add golden tests for semantic similarity thresholds and personalised score blending.'
  )
}
if (!exists('tests/unit/lib/search/generated.test.ts')) {
  failures.push(
    'tests/unit/lib/search/generated.test.ts is required for search quality governance. ' +
    'Add deterministic generated query scenarios for food/cuisine/vibe/typo coverage.'
  )
}

// B-577: typo tolerance documentation
requireTerms('product/SEARCH.md', ['Typo tolerance', 'trgm'], 'warning')

failures.push(
  ...searchIndexContractFailures({
    searchDoc: exists('product/SEARCH.md') ? readText('product/SEARCH.md') : '',
    schemaSource: schema,
    searchServiceSource: searchService,
    searchPipelineSource: '',
    restaurantServiceSource: exists('lib/services/places.ts') ? readText('lib/services/places.ts') : '',
  }),
)

printResult(
  {
    name: 'Search governance checks',
    failures,
    warnings,
    summary: {
      mode: 'report-only',
      signals: [
        'index-ownership',
        'refresh-cadence',
        'stale-handling',
        'ranking-recalculation',
        'cache-rules',
        'precomputed-signals',
        'cuisine-taxonomy',
      ],
    },
  },
  args,
)
