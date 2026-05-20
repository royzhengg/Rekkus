#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  BACKLOG_HEADER,
  duplicateBacklogIds,
  hasExpectedBacklogSchema,
  parseBacklogRows,
  rowsById,
} = require('./lib/backlog')
const { parseFeatureFlags, referencesForFlag } = require('./lib/feature-flags')
const { changedFiles, recentCommits } = require('./lib/git')
const { exists, listFiles, readJson, readText, repoPath } = require('./lib/files')

const args = new Set(process.argv.slice(2))
const today = new Date().toISOString().slice(0, 10)

const result = {
  generatedAt: new Date().toISOString(),
  failures: [],
  warnings: [],
  summary: {},
}

run()

function run() {
  const backlogRows = parseBacklogRows()
  const backlogById = rowsById(backlogRows)
  const changed = changedFiles()
  const commits = recentCommits()
  const migrations = checkMigrations()
  const flags = checkFeatureFlags()
  const experiments = checkExperiments()
  const dependencies = checkDependencies()
  const disasterRecovery = checkDisasterRecovery()
  const deadCode = checkDeadCode()
  const jobMonitors = checkJobMonitors()
  const complianceChecks = checkComplianceAutomation()
  const evidence = checkBacklogEvidence(backlogById)

  checkBacklog(backlogRows)
  checkBacklogSpecificity(backlogRows)
  checkDocs(changed)
  checkDocumentationBudgets()
  checkRoadmapCoverage()
  checkArchitectureDrift()
  checkGovernanceReadiness()
  checkCostReadiness()
  checkRetryPolicy()
  checkAutomationRows(backlogById)
  checkOperationalRegisters()
  checkRiskReviewGovernance()
  checkDebtGovernance()
  checkBusinessInstrumentationGovernance()
  checkGovernanceLayerIndex()
  checkPrReviewAutomation()
  checkProductDocs()

  result.summary = {
    backlog: summarizeBacklog(backlogRows),
    backlogEvidence: evidence,
    changedFiles: categorizeFiles(changed),
    recentCommits: commits,
    migrations,
    featureFlags: flags,
    experiments,
    dependencies,
    disasterRecovery,
    deadCode,
    jobMonitors,
    complianceChecks,
    releaseReadiness: releaseReadiness(),
  }

  if (args.has('--audit')) runAudit()
  if (args.has('--write')) writeReports(result)

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (args.has('--summary')) {
    process.stdout.write(renderSummary(result))
  } else {
    process.stdout.write(renderCheckOutput(result))
  }

  process.exit(result.failures.length > 0 ? 1 : 0)
}

function checkBacklog(rows) {
  if (!hasExpectedBacklogSchema()) {
    result.failures.push(`BACKLOG.md must use the expanded schema: ${BACKLOG_HEADER}`)
  }

  const allowedImplementationTypes = new Set([
    'runtime-feature',
    'migration',
    'guardrail',
    'automation',
    'ops-workflow',
    'docs',
    'restructure',
    'audit',
    'policy',
    'none',
  ])

  for (const id of duplicateBacklogIds(rows)) {
    result.failures.push(`BACKLOG.md contains duplicate ID ${id}.`)
  }

  rows.forEach((row, index) => {
    const expected = `B-${String(index + 1).padStart(3, '0')}`
    if (row.id !== expected) {
      result.failures.push(`BACKLOG.md row ${index + 1} must be ${expected}; found ${row.id}.`)
    }
    const anchor = `id="b-${String(index + 1).padStart(3, '0')}"`
    if (!row.line.includes(anchor)) {
      result.failures.push(`${row.id} anchor must match ${anchor}.`)
    }
  })

  const statusPattern = /^(\[[ x~]\]|Deprioritized)$/
  for (const row of rows) {
    if (row.cellCount !== 11) {
      result.failures.push(`${row.id} must have 11 table cells; found ${row.cellCount}.`)
    }
    if (!statusPattern.test(row.status)) {
      result.failures.push(`${row.id} has invalid status "${row.status}".`)
    }
    if (!row.problem) {
      result.failures.push(`${row.id} is missing a Problem statement.`)
    }
    if (!row.implementation) {
      result.failures.push(`${row.id} is missing an Implementations note.`)
    }
    if (!allowedImplementationTypes.has(row.implementationType)) {
      result.failures.push(`${row.id} has invalid Implementation Type "${row.implementationType}".`)
    }
    if (row.status === '[x]' && row.implementationType === 'none') {
      result.failures.push(`${row.id} is marked [x] but has Implementation Type none.`)
    }
    if (row.status === '[ ]' && !row.command.startsWith('Do: ')) {
      result.failures.push(`${row.id} is open but Suggested AI Command does not start with "Do: ".`)
    }
    if (row.implementation.startsWith('Shipped:') && row.status !== '[x]') {
      result.failures.push(`${row.id} has a shipped implementation but is not marked [x].`)
    }
    if (row.status === '[x]' && /^Not implemented yet\./i.test(row.implementation)) {
      result.failures.push(`${row.id} is marked [x] but its implementation still says not implemented.`)
    }
    if (
      row.status === '[x]' &&
      ['docs', 'restructure', 'audit', 'policy'].includes(row.implementationType) &&
      !isDocsPolicyOrRestructureItem(row)
    ) {
      result.failures.push(
        `${row.id} is shipped as ${row.implementationType}; confirm this is enough or reopen for implementation.`,
      )
    }
  }
}

function isDocsPolicyOrRestructureItem(row) {
  return /\.md|docs?|documentation|restructure|governance|policy|strategy|plan|template|index|readme|adr|cadence|current-state|observability|foundation|maturity|requirements|review|taxonomy|debt/i.test(
    `${row.item} ${row.why}`,
  )
}

function checkBacklogSpecificity(rows) {
  const vagueItemPattern = /\b(setup|governance|plan|strategy|requirements|docs?|system)\b$/i
  const bareDocPattern = /^`?(?:docs|product|design|business|operations)\//
  const missingCommands = []
  const vagueItems = []
  const weakCommands = []

  for (const row of rows) {
    if (!row.command) {
      missingCommands.push(row.id)
    }
    if (vagueItemPattern.test(row.item) || bareDocPattern.test(row.item)) {
      vagueItems.push(row.id)
    }
    if (
      row.command &&
      !/\b(implement|add|update|verify|remind Roy|document|reopen|ship|create|wire)\b/i.test(row.command)
    ) {
      weakCommands.push(row.id)
    }
  }

  if (missingCommands.length) {
    result.warnings.push(
      `Backlog specificity: ${missingCommands.length} rows should add Suggested AI Commands when next touched (${missingCommands.slice(0, 8).join(', ')}${missingCommands.length > 8 ? ', ...' : ''}).`,
    )
  }
  if (vagueItems.length) {
    result.warnings.push(
      `Backlog specificity: ${vagueItems.length} rows have vague item names to tighten when next touched (${vagueItems.slice(0, 8).join(', ')}${vagueItems.length > 8 ? ', ...' : ''}).`,
    )
  }
  if (weakCommands.length) {
    result.warnings.push(
      `Backlog specificity: ${weakCommands.length} commands should name the delivery action (${weakCommands.slice(0, 8).join(', ')}${weakCommands.length > 8 ? ', ...' : ''}).`,
    )
  }
}

function checkMigrations() {
  const files = listFiles('supabase/migrations', (filePath) => filePath.endsWith('.sql'))
  const names = files.map((file) => path.basename(file))
  const documented = new Set(
    [...readText('docs/architecture/ARCHITECTURE.md').matchAll(/`(\d{14}_[^`]+\.sql)`/g)].map(
      (match) => match[1],
    ),
  )

  const seen = new Set()
  for (const name of names) {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
      result.failures.push(`Migration ${name} must match YYYYMMDDHHMMSS_name.sql.`)
    }
    if (seen.has(name)) result.failures.push(`Duplicate migration filename ${name}.`)
    seen.add(name)
    if (!documented.has(name)) {
      result.warnings.push(`Migration ${name} is not listed in docs/architecture/ARCHITECTURE.md.`)
    }
  }

  const sorted = [...names].sort()
  if (names.join('\n') !== sorted.join('\n')) {
    result.failures.push('Supabase migration filenames are not sorted chronologically.')
  }

  return {
    count: names.length,
    undocumented: names.filter((name) => !documented.has(name)),
  }
}

function checkFeatureFlags() {
  const flags = parseFeatureFlags()
  if (flags.length === 0) {
    result.failures.push('lib/featureFlags.ts must define metadata-backed feature flags.')
    return { count: 0, stale: [], unreferenced: [] }
  }

  const stale = []
  const unreferenced = []
  for (const flag of flags) {
    for (const field of ['owner', 'state', 'createdAt', 'reviewAt', 'description']) {
      if (!flag[field]) result.failures.push(`Feature flag ${flag.name} is missing ${field}.`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flag.createdAt) || !/^\d{4}-\d{2}-\d{2}$/.test(flag.reviewAt)) {
      result.failures.push(`Feature flag ${flag.name} must use YYYY-MM-DD dates.`)
    }
    if (!flag.enabled && flag.reviewAt < today) {
      stale.push(flag.name)
      result.warnings.push(`Disabled feature flag ${flag.name} is past review date ${flag.reviewAt}.`)
    }

    const references = referencesForFlag(flag.name)
    if (references.length === 0) {
      unreferenced.push(flag.name)
      result.warnings.push(`Feature flag ${flag.name} is not referenced outside lib/featureFlags.ts.`)
    }
  }

  return { count: flags.length, stale, unreferenced }
}

function checkExperiments() {
  if (!exists('operations/EXPERIMENTS.md')) {
    result.failures.push('operations/EXPERIMENTS.md is required for experiment tracking.')
    return { active: 0, expired: [] }
  }

  const source = readText('operations/EXPERIMENTS.md')
  const rows = source
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Name |'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))

  const expired = []
  for (const cells of rows) {
    const [name, status, owner, hypothesis, startDate, expiryDate, successMetric, rollbackTrigger] = cells
    if (!name) continue
    const missing = []
    if (!owner) missing.push('owner')
    if (!hypothesis) missing.push('hypothesis')
    if (!startDate) missing.push('start date')
    if (!expiryDate) missing.push('expiry date')
    if (!successMetric) missing.push('success metric')
    if (!rollbackTrigger) missing.push('rollback trigger')
    if (missing.length) result.failures.push(`Experiment ${name} is missing ${missing.join(', ')}.`)
    if (status === 'Active' && expiryDate < today) {
      expired.push(name)
      result.warnings.push(`Experiment ${name} expired on ${expiryDate}.`)
    }
  }

  return {
    active: rows.filter((cells) => cells[1] === 'Active').length,
    expired,
  }
}

function checkDependencies() {
  const pkg = readJson('package.json')
  const dependencies = Object.keys(pkg.dependencies ?? {})
  const devDependencies = Object.keys(pkg.devDependencies ?? {})
  return {
    dependencies: dependencies.length,
    devDependencies: devDependencies.length,
    direct: dependencies.sort(),
  }
}

function checkDisasterRecovery() {
  if (!exists('scripts/ops/check-disaster-recovery.js')) {
    result.failures.push('scripts/ops/check-disaster-recovery.js is required for backup/restore drill verification.')
    return { runnable: false }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-disaster-recovery.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  if (check.error) {
    result.failures.push(`Disaster recovery check could not run: ${check.error.message}`)
    return { runnable: false }
  }

  let parsed = null
  try {
    parsed = JSON.parse(check.stdout)
  } catch (error) {
    result.failures.push('Disaster recovery check did not return valid JSON.')
  }

  if (check.status !== 0) {
    const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
    result.failures.push(`Disaster recovery check failed: ${details || 'unknown failure'}`)
  }

  if (parsed?.warnings?.length) {
    for (const warning of parsed.warnings) result.warnings.push(`Disaster recovery: ${warning}`)
  }

  return {
    runnable: check.status === 0,
    mode: parsed?.mode ?? 'unknown',
    source: parsed?.source ?? null,
    criticalTables: parsed?.criticalTables ?? [],
    criticalBuckets: parsed?.criticalBuckets ?? [],
  }
}

function checkDeadCode() {
  if (!exists('scripts/ops/check-dead-code.js')) {
    result.failures.push('scripts/ops/check-dead-code.js is required for dead-code detection.')
    return { candidates: [] }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-dead-code.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  if (check.error) {
    result.warnings.push(`Dead-code check could not run: ${check.error.message}`)
    return { candidates: [] }
  }

  try {
    const parsed = JSON.parse(check.stdout)
    return { candidates: parsed.candidates ?? [] }
  } catch (error) {
    result.warnings.push('Dead-code check did not return valid JSON.')
    return { candidates: [] }
  }
}

function checkJobMonitors() {
  if (!exists('scripts/ops/check-job-monitors.js')) {
    result.failures.push('scripts/ops/check-job-monitors.js is required for report-only job monitor checks.')
    return { runnable: false }
  }

  const check = spawnSync(process.execPath, [repoPath('scripts/ops/check-job-monitors.js'), '--json'], {
    cwd: repoPath(),
    encoding: 'utf8',
  })

  let parsed = null
  try {
    parsed = JSON.parse(check.stdout)
  } catch (error) {
    result.failures.push('Job monitor check did not return valid JSON.')
  }

  if (check.status !== 0) {
    const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
    result.failures.push(`Job monitor check failed: ${details || 'unknown failure'}`)
  }

  for (const warning of parsed?.warnings ?? []) {
    result.warnings.push(`jobs: ${warning}`)
  }

  return {
    runnable: check.status === 0,
    mode: parsed?.summary?.mode ?? 'unknown',
    monitors: parsed?.summary?.monitors ?? [],
  }
}

function checkComplianceAutomation() {
  const checks = [
    ['compliance', 'scripts/ops/check-compliance.js'],
    ['dataInventory', 'scripts/ops/check-data-inventory.js'],
    ['rls', 'scripts/ops/check-rls.js'],
    ['audit', 'scripts/ops/check-audit.js'],
    ['providers', 'scripts/ops/check-providers.js'],
    ['privacy', 'scripts/ops/check-privacy.js'],
    ['jobs', 'scripts/ops/check-job-monitors.js'],
    ['iso', 'scripts/ops/check-iso.js'],
  ]
  const summary = {}

  for (const [name, scriptPath] of checks) {
    if (!exists(scriptPath)) {
      result.failures.push(`${scriptPath} is required for compliance automation.`)
      summary[name] = { runnable: false, failures: 1, warnings: 0 }
      continue
    }

    const check = spawnSync(process.execPath, [repoPath(scriptPath), '--json'], {
      cwd: repoPath(),
      encoding: 'utf8',
    })

    let parsed = null
    try {
      parsed = JSON.parse(check.stdout)
    } catch (error) {
      result.failures.push(`${scriptPath} did not return valid JSON.`)
    }

    if (check.status !== 0) {
      const details = parsed?.failures?.length ? parsed.failures.join('; ') : check.stderr.trim()
      result.failures.push(`${name} check failed: ${details || 'unknown failure'}`)
    }

    for (const warning of parsed?.warnings ?? []) {
      result.warnings.push(`${name}: ${warning}`)
    }

    summary[name] = {
      runnable: check.status === 0,
      failures: parsed?.failures?.length ?? 0,
      warnings: parsed?.warnings?.length ?? 0,
    }
  }

  return summary
}

function checkDocs(changed) {
  for (const obsolete of ['ANALYTICS.md', 'BETA.md', 'DESIGN_SPEC.md', 'FEATURES.md', 'FEED.md', 'LESSONS.md', 'SEARCH.md']) {
    if (exists(obsolete)) {
      result.warnings.push(`${obsolete} exists at repo root; owner-folder doc may supersede it.`)
    }
  }

  const changedCode = changed.some((file) => /^(app|features|components|lib|supabase)\//.test(file))
  const changedDocs = changed.some((file) => /^(docs|product|design|operations|business)\//.test(file) || file === 'BACKLOG.md')
  if (changedCode && !changedDocs) {
    result.warnings.push('Code changed without nearby docs/backlog changes; confirm documentation is still current.')
  }
}

function checkDocumentationBudgets() {
  const ownerDocs = [
    'product/README.md',
    'design/README.md',
    'business/README.md',
    'operations/README.md',
    'docs/README.md',
    'docs/GOVERNANCE.md',
  ]

  for (const file of ownerDocs) {
    if (!exists(file)) result.failures.push(`${file} is required as an owner/index doc.`)
  }

  const markdownFiles = [
    ...listFiles('docs', (filePath) => filePath.endsWith('.md')),
    ...listFiles('product', (filePath) => filePath.endsWith('.md')),
    ...listFiles('design', (filePath) => filePath.endsWith('.md')),
    ...listFiles('business', (filePath) => filePath.endsWith('.md')),
    ...listFiles('operations', (filePath) => filePath.endsWith('.md')),
  ]

  for (const file of markdownFiles) {
    const lines = readText(file).split('\n').length
    if (lines > 300) {
      result.warnings.push(`${file} is ${lines} lines; consider splitting or tightening per documentation budgets.`)
    }
  }
}

function checkRoadmapCoverage() {
  const plan = readText('Rekkus — AI Operating System Master Plan.md')
  const backlog = readText('BACKLOG.md')
  const sections = [...plan.matchAll(/^#\s+\d+\.\s+(.+)$/gm)].map((match) => match[1].trim())
  const aliases = {
    'High-Level Repository Structure': ['Repository boundary maturity review', 'Repo navigation'],
    'Product Documentation Architecture': ['Pre-MVP Product Doc Targets', 'Product docs restructure'],
    'Business Documentation Architecture': ['Pre-MVP Business Doc Targets', 'Business docs setup'],
    'Core Entity Graph': ['Entity Graph', 'Dish graph'],
    'Async / Background Processing': ['Async Processing', 'Background jobs'],
    'Release & Migration Governance': ['Release Governance', 'Migration governance'],
    'Discovery Fairness & Freshness': ['Discovery Fairness'],
    'Offline / Weak-Network UX': ['Offline UX', 'weak-network'],
    'Data Portability & Trust': ['Data Portability'],
    'Reputation Recovery Systems': ['Reputation Recovery'],
    'Critical Thinking Expectations': ['AI Execution & Decision Framework', 'Critical thinking'],
    'Additional Governance & System Layers': ['Additional Governance Layers'],
  }

  for (const section of sections) {
    const candidates = [section, section.replace(/&/g, 'and'), ...(aliases[section] ?? [])]
    if (!candidates.some((candidate) => backlog.includes(candidate))) {
      result.warnings.push(`Master plan section "${section}" may not be represented in BACKLOG.md coverage.`)
    }
  }
}

function checkArchitectureDrift() {
  const repoMap = readText('REPO_MAP.md')
  const activeRoots = [...repoMap.matchAll(/^- `([^`/]+)\/`:/gm)].map((match) => match[1])
  for (const root of activeRoots) {
    if (!exists(root)) result.failures.push(`REPO_MAP.md lists missing root ${root}/.`)
  }

  for (const futureRoot of ['server', 'infra', 'tooling', 'schemas', 'moderation', 'analytics', 'store', 'domain']) {
    if (exists(futureRoot)) {
      result.warnings.push(`${futureRoot}/ exists; confirm ENGINEERING_GOVERNANCE.md documents the new boundary.`)
    }
  }
}

function checkGovernanceReadiness() {
  checkDataModeGovernance()
  checkSecurityComplianceGovernance()
  checkApiGovernance()
  checkCacheGovernance()
  checkFeatureFlagGovernance()
  checkTestingGovernance()
  checkDependencyGovernance()
  checkNamingGovernance()
  checkExperimentationGovernance()
  checkMediaGovernance()
  checkSearchIndexGovernance()
  checkObservabilityGovernance()
  checkPerformanceGovernance()
  checkBacklogLifecycleGovernance()
}

function requireTerms(file, terms, options = {}) {
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function checkDataModeGovernance() {
  requireTerms(
    'operations/DATA_MODE.md',
    ['mock', 'mixed', 'live', 'EXPO_PUBLIC_DATA_MODE', 'staging', 'beta', 'production', 'lib/mocks', 'lib/dataSources'],
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

function checkSecurityComplianceGovernance() {
  requireTerms(
    'docs/security/SECURITY.md',
    ['ISO 27001', 'RLS', 'service role', 'incident', 'dependency audit', 'data classification', 'risk register'],
    { label: 'security and compliance governance' },
  )
  requireTerms(
    'docs/security/COMPLIANCE.md',
    ['Compliance Impact', 'Data Inventory', 'Provider Register', 'Privacy Rights', 'Audit Evidence', 'ISO Readiness', 'Release Gate'],
    { label: 'app-wide compliance governance' },
  )
}

function checkApiGovernance() {
  requireTerms(
    'docs/architecture/API_GOVERNANCE.md',
    ['lib/services', 'Supabase', 'Google', 'Edge Functions', 'retry', 'cache', 'auth'],
    { label: 'API governance' },
  )

  const hygiene = readText('scripts/check-hygiene.js')
  for (const token of ['direct service/API access', 'serviceRoleKeyName', 'features/']) {
    if (!hygiene.includes(token)) result.warnings.push(`scripts/check-hygiene.js should include API guardrail token ${token}.`)
  }
}

function checkCacheGovernance() {
  requireTerms(
    'docs/architecture/CACHE_GOVERNANCE.md',
    ['TTL', 'invalidation', 'owner', 'Google Places', 'local DB', 'stale'],
    { label: 'cache governance' },
  )

  const googlePlaces = readText('lib/services/googlePlaces.ts')
  for (const token of ['CACHE_TTL_MS', 'inflight', 'MIN_AUTOCOMPLETE_LENGTH']) {
    if (!googlePlaces.includes(token)) result.warnings.push(`lib/services/googlePlaces.ts should expose ${token}.`)
  }
}

function checkFeatureFlagGovernance() {
  requireTerms(
    'operations/FEATURE_FLAGS.md',
    ['owner', 'state', 'reviewAt', 'rollback', 'stale', 'human override'],
    { label: 'feature-flag governance' },
  )
}

function checkTestingGovernance() {
  requireTerms(
    'docs/architecture/TESTING.md',
    ['check:docs', 'check:hygiene', 'check:ops', 'check:release', 'typecheck', 'lint', 'change type'],
    { label: 'testing governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  for (const scriptName of ['check:docs', 'check:hygiene', 'check:ops', 'check:release', 'typecheck']) {
    if (!scripts[scriptName]) result.failures.push(`package.json is missing ${scriptName}.`)
  }
}

function checkDependencyGovernance() {
  requireTerms(
    'docs/architecture/DEPENDENCIES.md',
    ['npm audit --audit-level=moderate', 'security', 'bundle', 'maintenance', 'owner', 'dependency'],
    { label: 'dependency governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:deps']) result.failures.push('package.json is missing check:deps.')
}

function checkNamingGovernance() {
  requireTerms(
    'docs/architecture/NAMING.md',
    ['snake_case', 'PascalCase', 'useCamelCase', 'lower_snake_case', 'plural domain nouns', 'Places', 'restaurant', 'analytics events'],
    { label: 'naming governance' },
  )

  requireTerms('docs/architecture/ARCHITECTURE.md', ['NAMING.md', 'Route naming'], {
    label: 'architecture naming linkage',
  })
}

function checkExperimentationGovernance() {
  requireTerms(
    'operations/EXPERIMENTS.md',
    ['owner', 'hypothesis', 'expiry date', 'success metric', 'rollback trigger', 'feature flags', 'Shipped', 'Stopped'],
    { label: 'experimentation governance' },
  )
}

function checkMediaGovernance() {
  requireTerms(
    'docs/security/MEDIA_PIPELINE.md',
    ['MIME type', 'maximum file size', 'user-scoped', 'variants', 'cleanup', 'storage growth', 'DISASTER_RECOVERY.md', 'operations/COSTS.md'],
    { label: 'media pipeline governance' },
  )

  requireTerms('docs/security/SECURITY.md', ['MEDIA_PIPELINE.md', 'Uploads validate type, size, and user-scoped path'], {
    label: 'security media linkage',
  })
}

function checkSearchIndexGovernance() {
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
    { label: 'search index governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:search']) result.failures.push('package.json is missing check:search.')
}

function checkObservabilityGovernance() {
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
    { label: 'observability governance' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['check:observability']) result.failures.push('package.json is missing check:observability.')
}

function checkPerformanceGovernance() {
  requireTerms(
    'docs/architecture/PERFORMANCE.md',
    ['Feed and grids', 'Search', 'Maps', 'Images', 'Startup', 'weak-network', 'check:release', 'device smoke test'],
    { label: 'mobile performance governance' },
  )

  requireTerms('docs/architecture/ENGINEERING_GOVERNANCE.md', ['PERFORMANCE.md', 'Mobile performance-sensitive flow'], {
    label: 'engineering performance linkage',
  })
}

function checkBacklogLifecycleGovernance() {
  requireTerms(
    'BACKLOG.md',
    ['Lifecycle model', '[ ]', '[~]', '[x]', 'Implementation Type', 'shipped history', 'reopen'],
    { label: 'backlog lifecycle governance' },
  )
}

function checkRiskReviewGovernance() {
  requireTerms(
    'operations/RISK_REVIEW.md',
    ['Reversibility', 'Blast radius', 'Operational burden', 'Observability', 'Human override', 'rollback', 'roll-forward'],
    { label: 'reversibility and burden review' },
  )
}

function checkDebtGovernance() {
  requireTerms(
    'operations/DEBT.md',
    ['Technical debt', 'Operational debt', 'Security debt', 'Product debt', 'Data debt', 'Cost debt', 'Growth debt', 'backlog'],
    { label: 'debt taxonomy' },
  )
}

function checkBusinessInstrumentationGovernance() {
  requireTerms(
    'business/INSTRUMENTATION.md',
    ['saved food intent', 'dish graph', 'taste graph', 'local density', 'restaurant value', 'privacy-safe', 'fairness'],
    { label: 'revenue and moat instrumentation' },
  )
}

function checkGovernanceLayerIndex() {
  requireTerms(
    'docs/GOVERNANCE_INDEX.md',
    ['Strategy', 'Execution', 'Architecture', 'Security', 'Analytics', 'Release', 'Business', 'Product', 'owner doc'],
    { label: 'governance layer index' },
  )
}

function checkPrReviewAutomation() {
  requireTerms(
    'operations/PR_REVIEW.md',
    ['Scope', 'reversible', 'Owner docs', 'Required checks', 'Security', 'release'],
    { label: 'PR review checklist' },
  )

  const scripts = readJson('package.json').scripts ?? {}
  if (!scripts['ops:pr']) result.failures.push('package.json is missing ops:pr.')
  if (!exists('scripts/ops/pr-summary.js')) result.failures.push('scripts/ops/pr-summary.js is required for ops:pr.')
}

function checkProductDocs() {
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
    requireTerms(file, terms, { label: `${file} product doc` })
    const name = file.replace('product/', '')
    if (!readme.includes(name)) result.warnings.push(`product/README.md should link to ${name}.`)
  }
}

function checkCostReadiness() {
  requireTerms(
    'operations/COSTS.md',
    ['Google', 'Supabase', 'Resend', 'Expo Push', 'storage', 'AI', 'quota', 'review gate', 'Owner'],
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

function checkRetryPolicy() {
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

function checkOperationalRegisters() {
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

function checkBacklogEvidence(backlogById) {
  const evidenceRules = new Map([
    ['B-021', ['scripts/check-markdown-links.js', 'package.json']],
    ['B-026', ['scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
    ['B-030', ['operations/RELEASE.md', 'scripts/check-platform.js']],
    ['B-032', ['app.config.js', 'scripts/check-hygiene.js']],
    ['B-033', ['scripts/ops/check-operations.js', 'docs/architecture/ARCHITECTURE.md']],
    ['B-035', ['operations/DATA_MODE.md', 'lib/config.ts', 'scripts/check-hygiene.js']],
    ['B-036', ['docs/security/SECURITY.md', 'scripts/ops/check-operations.js']],
    ['B-037', ['docs/architecture/API_GOVERNANCE.md', 'scripts/check-hygiene.js']],
    ['B-038', ['docs/architecture/CACHE_GOVERNANCE.md', 'lib/services/googlePlaces.ts']],
    ['B-039', ['operations/COSTS.md', 'operations/RELEASE.md', 'scripts/ops/check-operations.js']],
    ['B-040', ['operations/FEATURE_FLAGS.md', 'lib/featureFlags.ts', 'scripts/ops/lib/feature-flags.js']],
    ['B-041', ['docs/architecture/TESTING.md', 'package.json']],
    ['B-042', ['docs/architecture/DEPENDENCIES.md', 'package.json']],
    ['B-043', ['docs/architecture/NAMING.md', 'docs/architecture/ARCHITECTURE.md', 'scripts/ops/check-operations.js']],
    ['B-044', ['operations/EXPERIMENTS.md', 'scripts/ops/check-operations.js']],
    ['B-045', ['docs/security/MEDIA_PIPELINE.md', 'docs/security/SECURITY.md', 'scripts/ops/check-operations.js']],
    ['B-046', ['product/SEARCH.md', 'scripts/ops/check-operations.js']],
    ['B-047', ['operations/OBSERVABILITY.md', 'scripts/ops/check-operations.js']],
    ['B-048', ['docs/architecture/PERFORMANCE.md', 'docs/architecture/ENGINEERING_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
    ['B-049', ['operations/OPERATIONAL_CADENCE.md']],
    ['B-050', ['operations/CURRENT_STATE.md', 'scripts/ops/check-operations.js']],
    ['B-051', ['operations/INCIDENTS.md', 'operations/METRICS.md', 'operations/LAUNCHES.md']],
    ['B-052', ['operations/FOUNDER_OS.md', 'operations/OBSERVABILITY.md', 'scripts/ops/check-operations.js']],
    ['B-053', ['operations/AUTOMATION.md', 'scripts/ops/check-operations.js', 'package.json']],
    ['B-054', ['operations/AUTOMATION.md']],
    ['B-055', ['BACKLOG.md', 'scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
    ['B-057', ['operations/RISK_REVIEW.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
    ['B-058', ['operations/DEBT.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
    ['B-059', ['REPO_MAP.md', 'docs/architecture/ENGINEERING_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
    ['B-060', ['operations/FOUNDER_OS.md', 'scripts/ops/check-operations.js']],
    ['B-061', ['operations/AUTOMATION.md', 'scripts/ops/check-operations.js']],
    ['B-062', ['operations/CURRENT_STATE.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
    ['B-063', ['business/INSTRUMENTATION.md', 'docs/analytics/ANALYTICS.md', 'scripts/ops/check-operations.js']],
    ['B-064', ['docs/GOVERNANCE_INDEX.md', 'docs/README.md', 'scripts/ops/check-operations.js']],
    ['B-221', ['features/profile/ProfileScreen.tsx', 'lib/hooks/useSavedPosts.ts', 'lib/hooks/useLikedPosts.ts']],
    ['B-222', ['lib/services/users.ts', 'supabase/migrations/20240101000000_initial_schema.sql']],
    ['B-223', ['lib/hooks/usePagedList.ts', 'lib/services/posts.ts']],
    ['B-224', ['lib/services/notifications.ts', 'supabase/functions/send-push/index.ts']],
    ['B-225', ['features/auth/ForgotPasswordScreen.tsx', 'features/auth/ResetPasswordScreen.tsx']],
    ['B-226', ['features/settings/ConnectedAccountsScreen.tsx', 'lib/contexts/AuthContext.tsx']],
    ['B-227', ['app.config.js', 'lib/routes.ts']],
    ['B-228', ['lib/services/comments.ts', 'supabase/migrations/20240201000000_comment_threads.sql']],
    ['B-229', ['app.config.js', 'scripts/check-platform.js']],
    ['B-231', ['components/DishTagOverlay.tsx', 'supabase/migrations/20240117000000_dish_tags.sql']],
    ['B-232', ['components/post-create/DraggablePhotoStrip.tsx']],
    ['B-233', ['components/post-create/StepMedia.tsx']],
    ['B-234', ['lib/hooks/usePostVisitPrompt.ts']],
    ['B-235', ['features/search/SearchScreen.tsx', 'lib/hooks/useTrendingData.ts']],
    ['B-236', ['lib/hooks/useSearch.ts', 'supabase/migrations/20240202000000_search_query_expansion.sql']],
    ['B-237', ['lib/services/users.ts', 'supabase/migrations/20240101000000_initial_schema.sql']],
    ['B-238', ['features/posts/PostDetailScreen.tsx', 'supabase/migrations/20240125000000_post_reactions.sql']],
    ['B-191', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts', 'docs/architecture/ARCHITECTURE.md']],
    ['B-192', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/architecture/CACHE_GOVERNANCE.md', 'scripts/ops/check-providers.js']],
    ['B-193', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/adr/0002-provider-independent-restaurant-graph.md']],
    ['B-194', ['operations/JOBS.md', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-job-monitors.js']],
    ['B-195', ['operations/COSTS.md', 'scripts/ops/check-providers.js', 'lib/services/googlePlaces.ts']],
    ['B-196', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/adr/0002-provider-independent-restaurant-graph.md']],
    ['B-197', ['docs/security/COMPLIANCE.md', 'supabase/migrations/20240203000000_restaurant_compliance_graph.sql']],
    ['B-198', ['operations/JOBS.md', 'scripts/ops/check-operations.js', 'scripts/ops/check-job-monitors.js']],
    ['B-199', ['docs/analytics/ANALYTICS.md', 'operations/OBSERVABILITY.md']],
    ['B-200', ['lib/services/googlePlaces.ts']],
    ['B-201', ['lib/services/googlePlaces.ts']],
    ['B-202', ['lib/services/googlePlaces.ts']],
    ['B-203', ['lib/services/googlePlaces.ts']],
    ['B-171', ['lib/contexts/AuthContext.tsx', 'docs/security/SECURITY.md', 'scripts/ops/check-security-foundations.js']],
    ['B-172', ['lib/services/media.ts', 'docs/security/MEDIA_PIPELINE.md', 'scripts/check-hygiene.js']],
    ['B-173', ['lib/analytics.ts', 'lib/services/moderation.ts', 'scripts/ops/check-security-foundations.js']],
    ['B-174', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'lib/services/moderation.ts', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-175', ['features/posts/PostDetailScreen.tsx', 'features/profile/UserProfileScreen.tsx', 'lib/services/moderation.ts']],
    ['B-176', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md', 'docs/security/COMPLIANCE.md']],
    ['B-177', ['docs/security/SECURITY.md', 'operations/INCIDENTS.md', 'docs/security/COMPLIANCE.md']],
    ['B-178', ['docs/security/SECURITY.md', 'operations/RELEASE.md', 'docs/security/COMPLIANCE.md']],
    ['B-179', ['docs/architecture/DEPENDENCIES.md', 'operations/RELEASE.md', 'scripts/ops/check-security-foundations.js']],
    ['B-180', ['docs/security/COMPLIANCE.md', 'operations/RELEASE.md', 'scripts/ops/check-security-foundations.js']],
    ['B-181', ['design/DESIGN_SPEC.md', 'design/UI_LIBRARY.md', 'operations/RELEASE.md']],
    ['B-182', ['docs/security/COMPLIANCE.md', 'docs/moderation/MODERATION_OPERATIONS.md', 'operations/RELEASE.md']],
    ['B-183', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-184', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-185', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-186', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-audit.js']],
    ['B-187', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-188', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts']],
    ['B-189', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-190', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
    ['B-204', ['lib/hooks/useSearch.ts', 'product/SEARCH.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-205', ['docs/security/MEDIA_PIPELINE.md', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-206', ['docs/security/MEDIA_PIPELINE.md', 'lib/services/media.ts', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-207', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-208', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-209', ['docs/security/MEDIA_PIPELINE.md', 'docs/architecture/CACHE_GOVERNANCE.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-210', ['operations/COSTS.md', 'docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
    ['B-065', ['scripts/ops/check-operations.js']],
    ['B-066', ['operations/EXPERIMENTS.md', 'scripts/ops/check-operations.js']],
    ['B-067', ['lib/featureFlags.ts', 'scripts/ops/check-operations.js']],
    ['B-068', ['scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
    ['B-069', ['scripts/ops/check-operations.js']],
    ['B-070', ['scripts/ops/check-operations.js']],
    ['B-071', ['package.json', 'scripts/ops/check-operations.js']],
    ['B-072', ['scripts/ops/check-operations.js']],
    ['B-073', ['operations/JOBS.md', 'scripts/ops/check-operations.js']],
    ['B-076', ['REPO_MAP.md', 'scripts/ops/check-operations.js']],
    ['B-077', ['lib/featureFlags.ts', 'scripts/ops/lib/feature-flags.js']],
    ['B-074', ['scripts/ops/check-dead-code.js', 'package.json', 'scripts/ops/check-operations.js']],
    ['B-075', ['operations/PR_REVIEW.md', 'scripts/ops/pr-summary.js', 'package.json']],
    ['B-079', ['product/DISCOVERY.md', 'product/README.md']],
    ['B-080', ['product/RETENTION.md', 'product/README.md']],
    ['B-081', ['product/ACTIVATION.md', 'product/README.md']],
    ['B-082', ['product/NETWORK_EFFECTS.md', 'product/README.md']],
    ['B-083', ['product/GROWTH_LOOPS.md', 'product/README.md']],
    ['B-084', ['product/CONTRIBUTION_LOOPS.md', 'product/README.md']],
    ['B-085', ['product/TRUST.md', 'product/README.md']],
    ['B-086', ['product/QUALITY.md', 'product/README.md']],
    ['B-087', ['product/TASTE_GRAPH.md', 'product/README.md']],
    ['B-130', ['docs/architecture/DATA_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
    ['B-131', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'scripts/ops/check-audit.js', 'lib/services/restaurants.ts']],
    ['B-132', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
    ['B-133', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts']],
    ['B-134', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
    ['B-135', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
    ['B-136', ['lib/analytics.ts', 'scripts/ops/lib/policy-checks.js']],
    ['B-142', ['lib/services/media.ts', 'components/post-create/StepMedia.tsx', 'scripts/check-hygiene.js']],
    ['B-143', ['lib/services/media.ts', 'docs/security/MEDIA_PIPELINE.md']],
    ['B-144', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-operations.js']],
    ['B-145', ['docs/security/MEDIA_PIPELINE.md', 'lib/services/media.ts']],
    ['B-146', ['docs/security/MEDIA_PIPELINE.md', 'operations/COSTS.md']],
    ['B-147', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-job-monitors.js']],
    ['B-148', ['operations/COSTS.md', 'scripts/ops/check-operations.js']],
    ['B-149', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'package.json']],
    ['B-150', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
    ['B-151', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
    ['B-152', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
    ['B-153', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/services/googlePlaces.ts']],
    ['B-154', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/hooks/useSearch.ts']],
    ['B-155', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/utils/cuisineSynonyms.ts']],
    ['B-156', ['operations/OBSERVABILITY.md', 'components/ErrorBoundary.tsx', 'scripts/ops/check-observability.js']],
    ['B-157', ['operations/RELEASE.md', 'scripts/ops/check-observability.js', 'package.json']],
    ['B-158', ['docs/analytics/ANALYTICS.md', 'docs/analytics/EVENTS.md', 'lib/analytics.ts']],
    ['B-159', ['lib/analytics.ts', 'lib/contexts/AuthContext.tsx', 'scripts/ops/check-observability.js']],
    ['B-160', ['lib/analytics.ts', 'components/post-create/StepMedia.tsx', 'features/settings/EditProfileScreen.tsx']],
    ['B-161', ['operations/JOBS.md', 'scripts/ops/check-job-monitors.js', 'scripts/ops/check-observability.js']],
    ['B-162', ['operations/COSTS.md', 'scripts/ops/check-observability.js']],
    ['B-163', ['operations/COSTS.md', 'scripts/ops/check-observability.js']],
    ['B-164', ['operations/OBSERVABILITY.md', 'scripts/ops/check-observability.js']],
    ['B-165', ['operations/COSTS.md', 'docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-observability.js']],
    ['B-166', ['operations/LAUNCHES.md', 'scripts/ops/check-observability.js']],
    ['B-167', ['business/INSTRUMENTATION.md', 'scripts/ops/check-observability.js']],
    ['B-168', ['operations/FOUNDER_OS.md', 'scripts/ops/check-operations.js', 'scripts/ops/check-observability.js']],
    ['B-169', ['operations/FOUNDER_OS.md', 'operations/OBSERVABILITY.md', 'scripts/ops/check-observability.js']],
    ['B-170', ['.vscode/tasks.json', 'operations/FOUNDER_OS.md', 'scripts/ops/check-observability.js']],
  ])

  const verified = []
  const missingEvidence = []
  const docsOnly = []
  const needsImplementation = []

  for (const [id, files] of evidenceRules) {
    const row = backlogById.get(id)
    if (!row) continue
    const missing = files.filter((file) => !exists(file))
    if (missing.length === 0) {
      verified.push(id)
      if (row.status !== '[x]') {
        result.warnings.push(`${id} has implementation evidence but is not marked shipped.`)
      }
    } else {
      missingEvidence.push({ id, missing })
      if (row.status === '[x]') {
        result.warnings.push(`${id} is marked shipped but is missing evidence: ${missing.join(', ')}.`)
      }
    }
  }

  for (const row of backlogById.values()) {
    if (row.status !== '[x]') continue
    if (['docs', 'restructure', 'policy', 'audit'].includes(row.implementationType)) {
      docsOnly.push(row.id)
      if (!isDocsPolicyOrRestructureItem(row)) needsImplementation.push(row.id)
    }
  }

  return {
    verified,
    docsOnly,
    missingEvidence,
    needsImplementation,
  }
}

function checkAutomationRows(backlogById) {
  const implemented = new Map([
    ['B-065', 'stale-doc checks'],
    ['B-066', 'stale experiment checks'],
    ['B-067', 'stale feature detection'],
    ['B-068', 'backlog hygiene checks'],
    ['B-069', 'changelog/release-note generation'],
    ['B-070', 'migration tracking automation'],
    ['B-071', 'dependency health automation'],
    ['B-072', 'operational summary automation'],
    ['B-073', 'self-healing job policy'],
    ['B-074', 'dead-code detection'],
    ['B-075', 'PR summary/review checklist automation'],
    ['B-076', 'architecture drift detection'],
    ['B-077', 'feature-flag tracking'],
    ['B-078', 'human override requirements'],
  ])

  for (const [id, label] of implemented) {
    const row = backlogById.get(id)
    if (row && row.status !== '[x]') {
      result.warnings.push(`${id} (${label}) appears implemented by ops automation but is not marked shipped.`)
    }
  }
}

function runAudit() {
  const audit = spawnSync('npm', ['audit', '--audit-level=moderate'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  result.summary.npmAudit = {
    status: audit.status,
    output: `${audit.stdout}\n${audit.stderr}`.trim(),
  }

  if (audit.status !== 0) {
    result.warnings.push('npm audit reported moderate-or-higher issues. Run npm run check:deps for details.')
  }
}

function summarizeBacklog(rows) {
  return {
    total: rows.length,
    openP0: rows.filter((row) => row.status === '[ ]' && row.priority === 'P0').length,
    openP1: rows.filter((row) => row.status === '[ ]' && row.priority === 'P1').length,
    shipped: rows.filter((row) => row.status === '[x]').length,
  }
}

function releaseReadiness() {
  const release = readText('operations/RELEASE.md')
  return {
    hasLiveDataGate: /EXPO_PUBLIC_DATA_MODE=live/.test(release),
    hasRollbackGate: /rollback/i.test(release),
    hasBackupGate: /backup/i.test(release),
    hasQuotaGate: /quota/i.test(release),
    hasComplianceGate: /check:compliance/.test(release),
    hasPrivacyGate: /check:privacy/.test(release),
    hasAuditGate: /check:audit/.test(release),
    hasIsoGate: /check:iso/.test(release),
  }
}

function categorizeFiles(files) {
  const categories = {
    docs: [],
    appCode: [],
    supabase: [],
    operations: [],
    risk: [],
    other: [],
  }

  for (const file of files) {
    if (/^(docs|product|design|business)\//.test(file) || /\.md$/.test(file)) categories.docs.push(file)
    else if (/^(app|features|components|lib|constants|types)\//.test(file)) categories.appCode.push(file)
    else if (/^supabase\//.test(file)) categories.supabase.push(file)
    else if (/^operations\//.test(file)) categories.operations.push(file)
    else categories.other.push(file)

    if (/security|release|migration|supabase|config|env|package|lock/i.test(file)) categories.risk.push(file)
  }

  return categories
}

function writeReports(report) {
  const outDir = repoPath('.temp/ops')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(outDir, 'summary.md'), renderSummary(report))
}

function renderCheckOutput(report) {
  const lines = []
  if (report.failures.length === 0) lines.push('Operational checks passed.')
  else lines.push('Operational checks failed:')

  for (const failure of report.failures) lines.push(`- ${failure}`)
  if (report.warnings.length > 0) {
    lines.push('', 'Operational warnings:')
    for (const warning of report.warnings) lines.push(`- ${warning}`)
  }
  return `${lines.join('\n')}\n`
}

function renderSummary(report) {
  const changed = report.summary.changedFiles
  const lines = [
    '# Operational Summary',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Health',
    '',
    `- Failures: ${report.failures.length}`,
    `- Warnings: ${report.warnings.length}`,
    `- Backlog: ${report.summary.backlog.openP0} open P0, ${report.summary.backlog.openP1} open P1, ${report.summary.backlog.shipped} shipped`,
    `- Backlog evidence: ${report.summary.backlogEvidence.verified.length} verified, ${report.summary.backlogEvidence.needsImplementation.length} needs implementation`,
    `- Migrations: ${report.summary.migrations.count} total, ${report.summary.migrations.undocumented.length} undocumented`,
    `- Feature flags: ${report.summary.featureFlags.count} total, ${report.summary.featureFlags.unreferenced.length} unreferenced`,
    `- Experiments: ${report.summary.experiments.active} active, ${report.summary.experiments.expired.length} expired`,
    `- Compliance automation: ${Object.values(report.summary.complianceChecks).filter((check) => check.runnable).length}/${Object.values(report.summary.complianceChecks).length} checks passing`,
    `- Job monitors: ${report.summary.jobMonitors.runnable ? report.summary.jobMonitors.mode : 'not runnable'}`,
    '',
    '## Recent Commits',
    '',
    ...listOrNone(report.summary.recentCommits),
    '',
    '## Changed Files',
    '',
    `- Docs: ${changed.docs.length}`,
    `- App code: ${changed.appCode.length}`,
    `- Supabase: ${changed.supabase.length}`,
    `- Operations: ${changed.operations.length}`,
    `- Risk-sensitive: ${changed.risk.length}`,
    '',
    '## Warnings',
    '',
    ...listOrNone(report.warnings),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function listOrNone(items) {
  return items.length ? items.map((item) => `- ${item}`) : ['- None']
}
