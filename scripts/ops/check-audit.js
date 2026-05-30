#!/usr/bin/env node
const { getComplianceDoc, printResult, readSchemaSource } = require('./lib/policy-checks')
const { listFiles, readText } = require('./lib/files')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
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
  'feature_flag_audit_events',
]
for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i').test(schema)) {
    failures.push(`Audit architecture requires public.${table}.`)
  }
}

for (const table of ['auth_audit_events', 'content_lifecycle_events', 'dish_audit_events', 'restaurant_audit_events', 'restaurant_ownership_events', 'restaurant_merge_events', 'data_repair_events', 'post_edit_events', 'user_profile_audit_events', 'collection_audit_events', 'feature_flag_audit_events']) {
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

// B-519: Server-side auth audit guarantee — trigger and server RPC must exist.
// If auth_audit_log_trigger disappears, auth events revert to client-only (silent gap).
if (!/create\s+or\s+replace\s+function\s+(?:public\.)?auth_audit_log_trigger/i.test(schema)) {
  failures.push('auth_audit_log_trigger() must exist in migrations (B-519: server-side auth audit guarantee).')
}
if (!/create\s+trigger\s+auth_audit_login_trigger/i.test(schema)) {
  failures.push('auth_audit_login_trigger on auth.users must exist in migrations (B-519).')
}

// Verify every server-capturable event type is handled in the trigger function.
// logout is intentionally client-only (session invalidation does not update auth.users).
// If a new event type is added to the CHECK constraint, it must either be handled here
// or explicitly excluded with a documented reason — otherwise CI fails.
const triggerFnMatch = schema.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?auth_audit_log_trigger[\s\S]*?\$\$[\s\S]*?\$\$/i)
const triggerFnSql = triggerFnMatch ? triggerFnMatch[0] : ''
for (const eventType of ['login_email_success', 'login_oauth_success', 'password_changed', 'account_deleted']) {
  if (!triggerFnSql.includes(`'${eventType}'`)) {
    failures.push(`auth_audit_log_trigger must handle event type '${eventType}' (or document why it is client-only).`)
  }
}

// B-521: feature flag override writes are auditable at the database boundary.
const featureFlagTriggerMatch = schema.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?feature_flag_audit_trigger[\s\S]*?\$\$[\s\S]*?\$\$/i)
const featureFlagTriggerSql = featureFlagTriggerMatch ? featureFlagTriggerMatch[0] : ''
if (!featureFlagTriggerSql) {
  failures.push('feature_flag_audit_trigger() must exist in migrations (B-521).')
}
if (!/create\s+trigger\s+feature_flag_override_audit_trigger[\s\S]{0,120}after\s+insert\s+or\s+update\s+or\s+delete\s+on\s+(?:public\.)?feature_flag_overrides/i.test(schema)) {
  failures.push('feature_flag_override_audit_trigger must cover INSERT, UPDATE, and DELETE on feature_flag_overrides (B-521).')
}
for (const eventType of ['override_created', 'override_updated', 'override_removed']) {
  if (!featureFlagTriggerSql.includes(`'${eventType}'`)) {
    failures.push(`feature_flag_audit_trigger must handle event type '${eventType}' (B-521).`)
  }
}
if (/exception\s+when\s+others/i.test(featureFlagTriggerSql)) {
  failures.push('feature_flag_audit_trigger must fail closed; do not swallow audit insert failures (B-521).')
}

// B-522: Self-service account deletion RPC must exist in migrations.
if (!/create\s+or\s+replace\s+function\s+(?:public\.)?delete_own_account/i.test(schema)) {
  failures.push('delete_own_account() RPC must exist in migrations (B-522: account deletion audit trail).')
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
  'feature flag audit',
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
