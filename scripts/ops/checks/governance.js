'use strict'
const { exists, readText, readJson, listFiles } = require('../lib/files')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function requireTerms(file, terms, result, options = {}) {
  const source = readText(file)
  if (!source) {
    result.failures.push(`${file} is required for ${options.label ?? 'governance'} coverage.`)
    return
  }

  for (const term of terms) {
    const pattern = term instanceof RegExp ? term : new RegExp(escapeRegExp(term), 'i')
    if (!pattern.test(source)) {
      const label = term instanceof RegExp ? term.source : term
      result.warnings.push(`${file} should include "${label}" coverage.`)
    }
  }
}

function checkDataModeGovernance(result) {
  requireTerms(
    'operations/DATA_MODE.md',
    ['mock', 'mixed', 'live', 'EXPO_PUBLIC_DATA_MODE', 'staging', 'beta', 'production', 'lib/mocks', 'lib/dataSources'],
    result,
    { label: 'data-mode governance' },
  )

  const config = readText('lib/config.ts')
  for (const token of ['DATA_MODE', 'ALLOW_MOCK_DATA', 'IS_LIVE_DATA']) {
    if (!config.includes(token)) result.failures.push(`lib/config.ts must expose ${token}.`)
  }

  const hygiene = readText('scripts/check-hygiene.js')
  for (const token of ['EXPO_PUBLIC_DATA_MODE', 'lib/mocks']) {
    if (!hygiene.includes(token)) result.warnings.push(`scripts/check-hygiene.js should enforce ${token} coverage.`)
  }
}

function checkSecurityComplianceGovernance(result) {
  requireTerms(
    'docs/security/SECURITY.md',
    ['ISO 27001', 'RLS', 'service role', 'incident', 'dependency audit', 'data classification', 'risk register'],
    result,
    { label: 'security and compliance governance' },
  )
  requireTerms(
    'docs/security/COMPLIANCE.md',
    ['Compliance Impact', 'Data Inventory', 'Provider Register', 'Privacy Rights', 'Audit Evidence', 'ISO Readiness', 'Release Gate'],
    result,
    { label: 'app-wide compliance governance' },
  )
}

function checkApiGovernance(result) {
  requireTerms(
    'docs/architecture/API_GOVERNANCE.md',
    ['lib/services', 'Supabase', 'Google', 'Edge Functions', 'retry', 'cache', 'auth'],
    result,
    { label: 'API governance' },
  )

  const hygiene = readText('scripts/check-hygiene.js')
  for (const token of ['direct service/API access', 'serviceRoleKeyName', 'features/']) {
    if (!hygiene.includes(token)) result.warnings.push(`scripts/check-hygiene.js should include API guardrail token ${token}.`)
  }
}

function checkCacheGovernance(result) {
  requireTerms(
    'docs/architecture/CACHE_GOVERNANCE.md',
    ['TTL', 'invalidation', 'owner', 'Google Places', 'local DB', 'stale'],
    result,
    { label: 'cache governance' },
  )

  const googlePlaces = readText('lib/services/googlePlaces.ts')
  for (const token of ['CACHE_TTL_MS', 'inflight', 'MIN_AUTOCOMPLETE_LENGTH']) {
    if (!googlePlaces.includes(token)) result.warnings.push(`lib/services/googlePlaces.ts should expose ${token}.`)
  }
}

function checkFeatureFlagGovernance(result) {
  requireTerms(
    'operations/FEATURE_FLAGS.md',
    ['owner', 'state', 'reviewAt', 'rollback', 'stale', 'human override'],
    result,
    { label: 'feature-flag governance' },
  )
}

function checkTestingGovernance(result) {
  requireTerms(
    'docs/architecture/TESTING.md',
    ['check:docs', 'check:hygiene', 'check:ops', 'check:release', 'typecheck', 'lint', 'change type'],
    result,
    { label: 'testing governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  for (const scriptName of ['check:docs', 'check:hygiene', 'check:ops', 'check:release', 'typecheck']) {
    if (!scripts[scriptName]) result.failures.push(`package.json is missing ${scriptName}.`)
  }
}

function checkDependencyGovernance(result) {
  requireTerms(
    'docs/architecture/DEPENDENCIES.md',
    ['npm audit --audit-level=moderate', 'security', 'bundle', 'maintenance', 'owner', 'dependency'],
    result,
    { label: 'dependency governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:deps']) result.failures.push('package.json is missing check:deps.')
}

function checkNamingGovernance(result) {
  requireTerms(
    'docs/architecture/NAMING.md',
    ['snake_case', 'PascalCase', 'useCamelCase', 'lower_snake_case', 'plural domain nouns', 'Places', 'restaurant', 'analytics events'],
    result,
    { label: 'naming governance' },
  )

  requireTerms('docs/architecture/ARCHITECTURE.md', ['NAMING.md', 'Route naming'], result, {
    label: 'architecture naming linkage',
  })
}

function checkExperimentationGovernance(result) {
  requireTerms(
    'operations/EXPERIMENTS.md',
    ['owner', 'hypothesis', 'expiry date', 'success metric', 'rollback trigger', 'feature flags', 'Shipped', 'Stopped'],
    result,
    { label: 'experimentation governance' },
  )
}

function checkMediaGovernance(result) {
  requireTerms(
    'docs/security/MEDIA_PIPELINE.md',
    ['MIME type', 'maximum file size', 'user-scoped', 'variants', 'cleanup', 'storage growth', 'DISASTER_RECOVERY.md', 'operations/COSTS.md'],
    result,
    { label: 'media pipeline governance' },
  )

  requireTerms('docs/security/SECURITY.md', ['MEDIA_PIPELINE.md', 'Uploads validate type, size, and user-scoped path'], result, {
    label: 'security media linkage',
  })
}

function checkSearchIndexGovernance(result) {
  requireTerms(
    'product/SEARCH.md',
    [
      'Search Index Governance',
      'Search Index Operations',
      'local-first',
      'Index source',
      'Refresh cadence',
      'Stale handling',
      'Ranking recalculation',
      'Search cache rules',
      'Precomputed search signals',
      'Cuisine taxonomy governance',
      'provider fallback',
    ],
    result,
    { label: 'search index governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:search']) result.failures.push('package.json is missing check:search.')
}

function checkObservabilityGovernance(result) {
  requireTerms(
    'operations/OBSERVABILITY.md',
    [
      'Visibility Targets',
      'Report-Only Signal Map',
      'Minimum Signal Contract',
      'Onboarding anomaly',
      'Upload failure',
      'API cost',
      'Founder command center',
      'VS Code operational surface',
      'Owner',
      'Source',
      'Cadence',
      'Response',
      'ops:summary',
    ],
    result,
    { label: 'observability governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:observability']) result.failures.push('package.json is missing check:observability.')
}

function checkPerformanceGovernance(result) {
  requireTerms(
    'docs/architecture/PERFORMANCE.md',
    ['Feed and grids', 'Search', 'Maps', 'Images', 'Startup', 'weak-network', 'check:release', 'device smoke test'],
    result,
    { label: 'mobile performance governance' },
  )

  requireTerms('docs/architecture/ENGINEERING_GOVERNANCE.md', ['PERFORMANCE.md', 'Mobile performance-sensitive flow'], result, {
    label: 'engineering performance linkage',
  })
}

function checkBacklogLifecycleGovernance(result) {
  requireTerms(
    'BACKLOG.md',
    ['Lifecycle model', '[ ]', '[~]', '[x]', 'Implementation Type', 'shipped history', 'reopen'],
    result,
    { label: 'backlog lifecycle governance' },
  )
}

function checkGovernanceReadiness(result) {
  checkDataModeGovernance(result)
  checkSecurityComplianceGovernance(result)
  checkApiGovernance(result)
  checkCacheGovernance(result)
  checkFeatureFlagGovernance(result)
  checkTestingGovernance(result)
  checkDependencyGovernance(result)
  checkNamingGovernance(result)
  checkExperimentationGovernance(result)
  checkMediaGovernance(result)
  checkSearchIndexGovernance(result)
  checkObservabilityGovernance(result)
  checkPerformanceGovernance(result)
  checkBacklogLifecycleGovernance(result)
}

function checkRiskReviewGovernance(result) {
  requireTerms(
    'operations/RISK_REVIEW.md',
    ['Reversibility', 'Blast radius', 'Operational burden', 'Observability', 'Human override', 'rollback', 'roll-forward'],
    result,
    { label: 'reversibility and burden review' },
  )
}

function checkDebtGovernance(result) {
  requireTerms(
    'operations/DEBT.md',
    ['Technical debt', 'Operational debt', 'Security debt', 'Product debt', 'Data debt', 'Cost debt', 'Growth debt', 'backlog'],
    result,
    { label: 'debt taxonomy' },
  )
}

function checkBusinessInstrumentationGovernance(result) {
  requireTerms(
    'business/INSTRUMENTATION.md',
    ['saved food intent', 'dish graph', 'taste graph', 'local density', 'restaurant value', 'privacy-safe', 'fairness'],
    result,
    { label: 'revenue and moat instrumentation' },
  )
}

function checkGovernanceLayerIndex(result) {
  requireTerms(
    'docs/GOVERNANCE_INDEX.md',
    ['Strategy', 'Execution', 'Architecture', 'Security', 'Analytics', 'Release', 'Business', 'Product', 'owner doc'],
    result,
    { label: 'governance layer index' },
  )
}

function checkPrReviewAutomation(result) {
  requireTerms(
    'operations/PR_REVIEW.md',
    ['Scope', 'reversible', 'Owner docs', 'Required checks', 'Security', 'release'],
    result,
    { label: 'PR review checklist' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['ops:pr']) result.failures.push('package.json is missing ops:pr.')
  if (!exists('scripts/ops/pr-summary.js')) result.failures.push('scripts/ops/pr-summary.js is required for ops:pr.')
}

function checkProductDocs(result) {
  const productDocs = new Map([
    ['product/DISCOVERY.md', ['dish-first', 'Local relevance', 'Google', 'Signals', 'generic restaurant directory']],
    ['product/RETENTION.md', ['saved', 'revisit', 'alerts', 'Signals', 'notifications']],
    ['product/ACTIVATION.md', ['first useful', 'First search', 'First saved', 'Guests', 'onboarding']],
    ['product/NETWORK_EFFECTS.md', ['reviews', 'saves', 'follow', 'dish tags', 'influencer']],
    ['product/GROWTH_LOOPS.md', ['Review sharing', 'Collections', 'Follow graph', 'Restaurant pages', 'measurable']],
    ['product/CONTRIBUTION_LOOPS.md', ['Reviews', 'Dish tags', 'Best-dish', 'Quality', 'Repeat contribution']],
    ['product/TRUST.md', ['transparent', 'privacy', 'RLS', 'moderation', 'SECURITY.md']],
    ['product/QUALITY.md', ['Specificity', 'Recency', 'Local relevance', 'Trust', 'Density']],
    ['product/TASTE_GRAPH.md', ['Entities', 'Current Inputs', 'Saves over likes', 'Deterministic signals', 'Privacy-safe']],
  ])

  const readme = readText('product/README.md')
  for (const [file, terms] of productDocs) {
    requireTerms(file, terms, result, { label: `${file} product doc` })
    const name = file.replace('product/', '')
    if (!readme.includes(name)) result.warnings.push(`product/README.md should link to ${name}.`)
  }
}

function checkCostReadiness(result) {
  requireTerms(
    'operations/COSTS.md',
    ['Google', 'Supabase', 'Resend', 'Expo Push', 'storage', 'AI', 'quota', 'review gate', 'Owner'],
    result,
    { label: 'cost governance' },
  )

  const searchable = `${readText('BACKLOG.md')}\n${readText('operations/RELEASE.md')}\n${readText('operations/OBSERVABILITY.md')}\n${readText('operations/COSTS.md')}\n${readText('docs/security/SECURITY.md')}`
  for (const term of ['Google', 'Supabase', 'Resend', 'Expo', 'storage', 'AI']) {
    if (!new RegExp(term, 'i').test(searchable)) {
      result.warnings.push(`Cost readiness is missing coverage for ${term}.`)
    }
  }

  const release = readText('operations/RELEASE.md')
  if (!/quota/i.test(release) || !/cost|API quota/i.test(release)) {
    result.warnings.push('operations/RELEASE.md should include quota/cost review gates.')
  }
}

function checkRetryPolicy(result) {
  if (!exists('operations/JOBS.md')) {
    result.warnings.push('operations/JOBS.md is missing; retry policy is not yet documented.')
  }

  const jobFiles = [
    ...listFiles('scripts', (filePath) => /\b(job|queue|cron|worker)\b/i.test(filePath)),
    ...listFiles('supabase/functions', (filePath) => /\b(job|queue|cron|worker)\b/i.test(filePath)),
  ]
  for (const file of jobFiles) {
    const source = readText(file)
    for (const token of ['maxAttempts', 'retry', 'manualOverride']) {
      if (!source.includes(token)) {
        result.warnings.push(`${file} looks job-like but does not expose ${token}.`)
      }
    }
  }
}

function checkOperationalRegisters(result) {
  const registers = new Map([
    ['operations/OPERATIONAL_CADENCE.md', ['Weekly', 'Monthly']],
    ['operations/CURRENT_STATE.md', ['Status', 'Risks']],
    ['operations/INCIDENTS.md', ['Incident', 'Owner']],
    ['operations/METRICS.md', ['Metric', 'Owner']],
    ['operations/LAUNCHES.md', ['Launch', 'Owner']],
    ['operations/FOUNDER_OS.md', ['Founder', 'Summary']],
    ['operations/OBSERVABILITY.md', ['Signal', 'Owner']],
  ])

  for (const [file, requiredTerms] of registers) {
    if (!exists(file)) {
      result.failures.push(`${file} is required for operational register coverage.`)
      continue
    }
    const source = readText(file)
    for (const term of requiredTerms) {
      if (!new RegExp(term, 'i').test(source)) {
        result.warnings.push(`${file} should include "${term}" coverage.`)
      }
    }
  }
}

module.exports = {
  checkGovernanceReadiness,
  checkCostReadiness,
  checkRetryPolicy,
  checkOperationalRegisters,
  checkRiskReviewGovernance,
  checkDebtGovernance,
  checkBusinessInstrumentationGovernance,
  checkGovernanceLayerIndex,
  checkPrReviewAutomation,
  checkProductDocs,
}
