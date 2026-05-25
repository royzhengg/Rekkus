#!/usr/bin/env node
const { getComplianceDoc, printResult, readSchemaSource } = require('./lib/policy-checks')
const { listFiles, readText } = require('./lib/files')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []
const schema = readSchemaSource()
const compliance = getComplianceDoc()

const requiredTables = [
  'auth_audit_events',
  'content_lifecycle_events',
  'dish_audit_events',
  'moderation_actions',
  'restaurant_audit_events',
  'restaurant_provider_cache',
  'restaurant_aliases',
  'restaurant_observations',
  'restaurant_ownership_events',
  'restaurant_merge_events',
  'data_repair_events',
  'post_edit_events',
  'user_profile_audit_events',
  'collection_audit_events',
]
for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i').test(schema)) {
    failures.push(`Audit architecture requires public.${table}.`)
  }
}

for (const table of ['auth_audit_events', 'content_lifecycle_events', 'dish_audit_events', 'restaurant_audit_events', 'restaurant_ownership_events', 'restaurant_merge_events', 'data_repair_events', 'post_edit_events', 'user_profile_audit_events', 'collection_audit_events']) {
  // FOR UPDATE or FOR DELETE always violates append-only audit table contract
  const hasUpdateOrDelete = new RegExp(
    `create\\s+policy\\s+["'][^"']+["']\\s+on\\s+(?:public\\.)?${table}\\b[\\s\\S]{0,260}for\\s+(?:update|delete)\\b`,
    'i',
  ).test(schema)
  // FOR ALL is acceptable ONLY when the lockdown pattern USING (false) is present in the same policy block
  const forAllBlocks = schema.match(
    new RegExp(`create\\s+policy\\s+["'][^"']+["']\\s+on\\s+(?:public\\.)?${table}\\b[\\s\\S]{0,400}?for\\s+all\\b[^;]*;`, 'gi'),
  ) ?? []
  const hasUnrestrictedAll = forAllBlocks.some(block => !/using\s*\(\s*false\s*\)/i.test(block))
  if (hasUpdateOrDelete || hasUnrestrictedAll) failures.push(`${table} must not expose update/delete/all policies.`)
}

// Verify platform_audit_events_view exists
if (!/create\s+or\s+replace\s+view\s+(?:public\.)?platform_audit_events_view/i.test(schema)) {
  failures.push('platform_audit_events_view must exist in migrations.')
}

// Dynamic completeness guardrail: every *_audit_events, *_edit_events, *_lifecycle_events table
// and the known non-pattern audit table (moderation_actions) must appear in the view migration.
const auditPattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+(?:_audit_events|_edit_events|_lifecycle_events))\b/gi
const auditTables = new Set(['moderation_actions'])
let _m
while ((_m = auditPattern.exec(schema)) !== null) auditTables.add(_m[1])

// Read all migration files whose content defines or updates platform_audit_events_view.
// This is more reliable than a file-name lookup (which only finds the dedicated view file) or a
// regex over the combined schema (which misidentifies ';' inside SQL comments as terminators).
// Any audit table migration that runs CREATE OR REPLACE VIEW will be included automatically.
const viewSql = listFiles('supabase/migrations', f => f.endsWith('.sql'))
  .filter(f => readText(f).toLowerCase().includes('platform_audit_events_view'))
  .map(f => readText(f))
  .join('\n')
for (const tbl of auditTables) {
  if (!viewSql.includes(tbl)) {
    failures.push(`${tbl} must be included in platform_audit_events_view.`)
  }
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
  'dish audit',
  'auth audit',
  'content lifecycle',
  'user profile audit',
  'collection audit',
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
