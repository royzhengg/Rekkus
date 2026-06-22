#!/usr/bin/env node
const { printResult } = require('./lib/policy-checks')
const { exists, readText } = require('./lib/files')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []

function requireTerms(file, terms, mode = 'warning') {
  if (!exists(file)) {
    failures.push(`${file} is required for Google cost reduction checks.`)
    return
  }
  const source = readText(file)
  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(term, 'i')
    if (!pattern.test(source)) {
      const label = term instanceof RegExp ? term.source : term
      const message = `${file} must include Google cost reduction coverage for "${label}".`
      if (mode === 'failure') failures.push(message)
      else warnings.push(message)
    }
  }
}

// B-509 refactor: main search moved to vector (search_semantic RPC + HNSW).
// Google Places fallback now lives only in usePlaceSearch.ts (place tagging flow).
// useSearch.ts no longer calls fetchPlaceAutocompleteJson — autocomplete is handled by useAutocomplete.ts.
requireTerms('lib/hooks/usePlaceSearch.ts', ['decideSearchProviderFallback', 'fetchPredictions'], 'failure')
requireTerms('lib/services/places.ts', ['fetchPlaceAutocompleteJson'], 'failure')
requireTerms('lib/services/search.ts', ['searchSemantic', 'embedQuery'], 'failure')
requireTerms('lib/services/googlePlaces.ts', ['CACHE_TTL_MS', 'MIN_AUTOCOMPLETE_LENGTH', 'inflight', 'cacheStatus', 'estimatedCostClass'], 'failure')
requireTerms(
  'docs/security/MEDIA_PIPELINE.md',
  ['Provider Photo Policy', 'Aggressive image compression', 'Thumbnail generation', 'Lazy image loading', 'CDN caching strategy', 'Storage growth monitoring'],
  'failure',
)
requireTerms('operations/COSTS.md', ['Storage Growth Monitor', 'API Cost Dashboard', 'CDN/egress', 'largest users by storage footprint', 'Key Rotation', 'Giphy'], 'failure')
requireTerms('docs/architecture/CACHE_GOVERNANCE.md', ['Google Places', 'TTL', 'stale', 'owner'], 'failure')

printResult(
  {
    name: 'Google cost reduction checks',
    failures,
    warnings,
    summary: {
      mode: 'guardrail',
      controls: [
        'local-first-search',
        'provider-dedupe',
        'minimum-query-length',
        'short-lived-cache',
        'provider-photo-policy',
        'media-variant-policy',
        'storage-growth',
      ],
    },
  },
  args,
)
