#!/usr/bin/env node
const { printResult, readSchemaSource } = require('./lib/policy-checks')
const { exists, readText } = require('./lib/files')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []
const schema = readSchemaSource()

function requireTerms(file, terms, mode = 'warning', companion = null) {
  if (!exists(file)) {
    failures.push(`${file} is required for security foundation checks.`)
    return
  }
  const companions = Array.isArray(companion) ? companion : (companion ? [companion] : [])
  const source = readText(file) + companions.filter(exists).map(readText).join('\n')
  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(term, 'i')
    if (!pattern.test(source)) {
      const label = term instanceof RegExp ? term.source : term
      const message = `${file} must include security foundation coverage for "${label}".`
      if (mode === 'failure') failures.push(message)
      else warnings.push(message)
    }
  }
}

for (const table of [
  'user_blocks',
  'content_reports',
  'moderation_actions',
  'moderation_appeals',
  'user_trust_profiles',
]) {
  if (!new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`, 'i').test(schema)) {
    failures.push(`Moderation/security foundations require public.${table}.`)
  }
  if (!new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(schema)) {
    failures.push(`public.${table} must enable RLS.`)
  }
}

for (const token of ['deleted_at', 'deleted_reason']) {
  if (!schema.includes(token)) failures.push(`Soft-delete foundations must include ${token}.`)
}

requireTerms('lib/services/moderation.ts', ['submitContentReport', 'blockUser', 'unblockUser', 'fetchBlockedUserIds', 'abuseSignal'], 'failure')
requireTerms('lib/analytics.ts', ['abuseSignal', 'abuse_signal', 'target_type'], 'failure', ['lib/analytics/events.ts', 'lib/analytics/privacy.ts', 'lib/analytics/core.ts'])
requireTerms('features/posts/PostDetailScreen.tsx', ['Report post', 'Report creator', 'Block creator'], 'failure', 'features/posts/PostDetailSheets.tsx')
requireTerms('features/posts/postDetailUtils.ts', ['submitContentReport', 'blockUser'], 'failure')
requireTerms('features/profile/UserProfileScreen.tsx', ['submitContentReport', 'blockUser', 'Report profile', 'Block user'], 'failure')
requireTerms(
  'docs/moderation/MODERATION_OPERATIONS.md',
  ['Moderation Queue', 'Report And Block Flow', 'Disputes And Takedowns', 'Progressive Permissions', 'Trust Scoring', 'Shadow Moderation', 'Moderation Appeals', 'Soft Delete'],
  'failure',
)
requireTerms('docs/security/SECURITY.md', ['Auth And Email Cooldowns', 'Vulnerability Disclosure', 'NDB/OAIC'], 'failure')
// Login rate limiting must exist in AuthContext — prevents regression where login lacks a cooldown while signup/reset have one
requireTerms('lib/contexts/AuthContext.tsx', ['loginFailed', 'checkCooldown'], 'failure')
requireTerms('docs/security/COMPLIANCE.md', ['content_reports', 'user_blocks', 'moderation_actions', 'moderation_appeals', 'DPIA/PIA'], 'failure')

printResult(
  {
    name: 'Security foundation checks',
    failures,
    warnings,
    summary: {
      mode: 'guardrail',
      tables: ['user_blocks', 'content_reports', 'moderation_actions', 'moderation_appeals', 'user_trust_profiles'],
    },
  },
  args,
)
