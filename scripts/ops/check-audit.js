#!/usr/bin/env node
const { getComplianceDoc, printResult, readSchemaSource } = require('./lib/policy-checks')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []
const schema = readSchemaSource()
const compliance = getComplianceDoc()

const requiredTables = [
  'restaurant_audit_events',
  'restaurant_provider_cache',
  'restaurant_aliases',
  'restaurant_observations',
  'restaurant_ownership_events',
  'restaurant_merge_events',
  'data_repair_events',
  'post_edit_events',
]
for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i').test(schema)) {
    failures.push(`Audit architecture requires public.${table}.`)
  }
}

for (const table of ['restaurant_audit_events', 'restaurant_ownership_events', 'restaurant_merge_events', 'data_repair_events', 'post_edit_events']) {
  const hasMutationPolicy = new RegExp(
    `create\\s+policy\\s+["'][^"']+["']\\s+on\\s+(?:public\\.)?${table}\\b[\\s\\S]{0,260}for\\s+(?:update|delete|all)`,
    'i',
  ).test(schema)
  if (hasMutationPolicy) failures.push(`${table} must not expose update/delete/all policies.`)
}

const restaurantService = require('./lib/files').readText('lib/services/restaurants.ts')
for (const helper of [
  'recordRestaurantAuditEvent',
  'submitRestaurantClaim',
  'recordRestaurantAlias',
  'recordRestaurantMergeEvidence',
  'reportDataRepair',
]) {
  if (!restaurantService.includes(helper)) failures.push(`lib/services/restaurants.ts must expose ${helper}.`)
}

const auditSubjects = [
  'canonical restaurant edits',
  'source links',
  'provider cache refreshes',
  'alias',
  'merge',
  'moderation',
  'admin actions',
  'account deletion',
  'privacy request',
  'post edit',
  'job runs',
]

for (const subject of auditSubjects) {
  if (!new RegExp(subject, 'i').test(compliance)) {
    warnings.push(`Compliance docs should mention audit coverage for ${subject}.`)
  }
}

printResult({
  name: 'Audit checks',
  failures,
  warnings,
  summary: { requiredTables: requiredTables.length },
}, args)
