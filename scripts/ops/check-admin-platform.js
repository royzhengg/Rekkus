#!/usr/bin/env node
const { exists, readText } = require('./lib/files')
const { printResult, requiredScriptMissing } = require('./lib/policy-checks')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []

const adminDoc = 'operations/ADMIN_PLATFORM.md'
const moderationDoc = 'docs/moderation/MODERATION_OPERATIONS.md'
const dashboardDoc = 'docs/analytics/DASHBOARDS.md'
const featureFlagDoc = 'operations/FEATURE_FLAGS.md'
const dataDoc = 'docs/architecture/DATA_GOVERNANCE.md'

function source(file) {
  return exists(file) ? readText(file) : ''
}

function requireFile(file) {
  if (!exists(file)) failures.push(`${file} is required for admin platform checks.`)
}

function requireTerms(file, terms, mode = 'failure') {
  requireFile(file)
  const text = source(file)
  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(term, 'i')
    if (pattern.test(text)) continue
    const label = term instanceof RegExp ? term.source : term
    const message = `${file} must document admin platform coverage for "${label}".`
    if (mode === 'failure') failures.push(message)
    else warnings.push(message)
  }
}

for (const scriptName of requiredScriptMissing(['check:admin-platform', 'ops:summary'])) {
  failures.push(`package.json is missing ${scriptName}.`)
}

requireTerms(adminDoc, [
  'Internal admin dashboard',
  'Moderation queue',
  'Ban/suspend users',
  'Hide/remove posts',
  'Merge duplicate restaurants',
  'Edit restaurant metadata',
  'Feature flag tooling',
  'Restaurant verification tooling',
  'User lookup',
  'Content repair tooling',
  'Abuse tooling',
  'Support tooling',
  'Operational dashboards',
  'Owner',
  'Source',
  'Action model',
  'Rollback',
  'Rollout',
  'content_reports',
  'moderation_actions',
  'user_trust_profiles',
  'restaurant_merge_events',
  'restaurant_ownership_events',
  'data_repair_events',
  'lib/featureFlags.ts',
  'npm run check:admin-platform',
])

requireTerms(moderationDoc, [
  'Moderation Queue',
  'Ban/suspend users',
  'Hide/remove posts',
  'user_trust_profiles',
  'deleted_at',
])

requireTerms(dashboardDoc, ['Admin operations', 'operations/ADMIN_PLATFORM.md', 'content_reports'])
requireTerms(featureFlagDoc, ['Admin platform', 'operations/ADMIN_PLATFORM.md'])
requireTerms(dataDoc, ['Admin platform', 'data_repair_events', 'restaurant_merge_events'])

const backlog = source('BACKLOG.md')
const completedItems = source('COMPLETED_ITEMS.md')
const backlogAndCompleted = backlog + '\n' + completedItems
for (let id = 370; id <= 382; id += 1) {
  const backlogId = `B-${id}`
  const row = backlogAndCompleted
    .split('\n')
    .find((line) => line.includes(`>${backlogId} |`) || line.includes(`>${backlogId}</a>`))
  if (!row) {
    failures.push(`Backlog is missing ${backlogId}.`)
    continue
  }
  if (!row.includes('[x]')) failures.push(`${backlogId} must be marked shipped after admin platform foundation ships.`)
  if (!/operations\/ADMIN_PLATFORM\.md/.test(row)) {
    failures.push(`${backlogId} must reference operations/ADMIN_PLATFORM.md as implementation evidence.`)
  }
}

printResult(
  {
    name: 'Admin platform checks',
    failures,
    warnings,
    summary: {
      controls: 13,
      source: adminDoc,
      mode: 'workflow-foundation',
    },
  },
  args,
)
