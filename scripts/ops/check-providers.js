#!/usr/bin/env node
const {
  directProviderAccessViolations,
  getComplianceDoc,
  missingTerms,
  printResult,
} = require('./lib/policy-checks')
const { readText } = require('./lib/files')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []

for (const violation of directProviderAccessViolations()) failures.push(violation)

for (const term of missingTerms('docs/security/COMPLIANCE.md', [
  'Provider Register',
  'cacheability',
  'retention',
  'attribution',
  'kill switch',
  'Google Places',
  'OpenStreetMap',
])) {
  failures.push(`Provider governance must include ${term}.`)
}

for (const term of missingTerms('operations/COSTS.md', [
  'Key Rotation',
  'Google Maps',
  'Google Places',
  'Giphy',
])) {
  failures.push(`Provider cost governance must include ${term}.`)
}

const googlePlaces = readText('lib/services/googlePlaces.ts')
for (const token of ['fields', 'sessionToken', 'inflight', 'MIN_AUTOCOMPLETE_LENGTH', 'logProviderUsage']) {
  if (!googlePlaces.includes(token)) warnings.push(`lib/services/googlePlaces.ts should include ${token}.`)
}

if (!/restaurantProvider/i.test(getComplianceDoc()) && !/provider gateway/i.test(getComplianceDoc())) {
  warnings.push('Compliance docs should name the restaurant provider gateway boundary.')
}

printResult({
  name: 'Provider checks',
  failures,
  warnings,
  summary: { directProviderViolations: directProviderAccessViolations().length },
}, args)
