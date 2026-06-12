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

const searchHook = exists('lib/hooks/useSearch.ts') ? readText('lib/hooks/useSearch.ts') : ''
for (const token of ['analytics_events']) {
  if (!searchHook.includes(token)) failures.push(`lib/hooks/useSearch.ts must retain ${token} search evidence.`)
}

const searchPipeline = exists('lib/search/pipeline.ts') ? readText('lib/search/pipeline.ts') : ''
for (const token of [
  'runSearchPipeline',
  'SearchCandidate',
  'fetchPlaceAutocompleteJson',
]) {
  if (!searchPipeline.includes(token)) failures.push(`lib/search/pipeline.ts must retain ${token} search evidence.`)
}

// Cuisine expansion logic moved to lib/services/search.ts in B-509
const searchService = exists('lib/services/search.ts') ? readText('lib/services/search.ts') : ''
for (const token of [
  'CUISINE_SYNONYMS',
  'expand_search_cuisines',
]) {
  if (!searchService.includes(token)) failures.push(`lib/services/search.ts must retain ${token} search evidence.`)
}

const googlePlaces = exists('lib/services/googlePlaces.ts') ? readText('lib/services/googlePlaces.ts') : ''
for (const token of ['CACHE_TTL_MS', 'MIN_AUTOCOMPLETE_LENGTH', 'inflight']) {
  if (!googlePlaces.includes(token)) warnings.push(`lib/services/googlePlaces.ts should retain ${token} cache guardrail.`)
}

const schema = readSchemaSource()
if (!/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?expand_search_cuisines\b/i.test(schema)) {
  failures.push('Supabase migrations must define public.expand_search_cuisines for deterministic search expansion.')
}

// B-585: require quality and generated test files
if (!exists('tests/unit/lib/search/quality.test.ts')) {
  failures.push(
    'tests/unit/lib/search/quality.test.ts is required for search quality governance. ' +
    'Add golden ranking principle tests for text relevance, distance, popularity, and entity intent.'
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
    searchPipelineSource: searchPipeline,
    restaurantServiceSource: exists('lib/services/restaurants.ts') ? readText('lib/services/restaurants.ts') : '',
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
