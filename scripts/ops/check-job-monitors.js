#!/usr/bin/env node
const { printResult, readSchemaSource } = require('./lib/policy-checks')
const { exists, readText } = require('./lib/files')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []
const schema = readSchemaSource()

const requiredTables = [
  'restaurant_provider_cache',
  'privacy_requests',
  'restaurant_audit_events',
  'restaurant_ownership_events',
  'restaurant_merge_events',
  'data_repair_events',
]

for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i').test(schema)) {
    failures.push(`Report-only monitors require public.${table}.`)
  }
}

const requiredJobTerms = [
  'Provider usage monitor',
  'Cache freshness monitor',
  'Audit completeness monitor',
  'Privacy request tracker',
  'report-only',
  'manualOverride',
  'maxAttempts',
  'retry',
]

const jobs = exists('operations/JOBS.md') ? readText('operations/JOBS.md') : ''
for (const term of requiredJobTerms) {
  if (!new RegExp(term, 'i').test(jobs)) {
    warnings.push(`operations/JOBS.md should include ${term} for report-only monitor readiness.`)
  }
}

if (exists('lib/analytics.ts')) {
  const analytics = readText('lib/analytics.ts')
  for (const token of ['sanitizeAnalyticsMetadata', 'SAFE_METADATA_KEYS', 'SENSITIVE_VALUE_PATTERN']) {
    if (!analytics.includes(token)) failures.push(`lib/analytics.ts must include ${token}.`)
  }
}

printResult({
  name: 'Report-only job monitor checks',
  failures,
  warnings,
  summary: {
    mode: 'report-only',
    monitors: ['provider-cache', 'privacy-requests', 'audit-completeness', 'job-policy'],
  },
}, args)
