#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { parseBacklogRows, rowsById } = require('./lib/backlog')
const { parseFeatureFlags } = require('./lib/feature-flags')
const { changedFiles, recentCommits } = require('./lib/git')
const { readText, readJson, repoPath } = require('./lib/files')

const { parseFlags, hasFlag, printHelp } = require('../lib/args')

const {
  checkBacklog,
  checkBacklogSpecificity,
  checkBacklogEvidence,
  checkAutomationRows,
  checkBacklogStructure,
  checkCompletedItemsOrder,
  summarizeBacklog,
} = require('./checks/backlog')
const { checkFeatureFlags, checkExperiments } = require('./checks/feature-flags')
const {
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
} = require('./checks/governance')
const {
  checkDocs,
  checkDocumentationBudgets,
  checkRoadmapCoverage,
  checkArchitectureDrift,
  checkMigrations,
} = require('./checks/docs')
const {
  checkDisasterRecovery,
  checkDeadCode,
  checkJobMonitors,
  checkComplianceAutomation,
} = require('./checks/external')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp('check:ops', 'Comprehensive operational checks: backlog, feature flags, dependencies, compliance, and more.', [
    ['--json', 'Output results as JSON'],
    ['--summary', 'Short summary output'],
    ['--audit', 'Include full audit detail'],
    ['--write', 'Write reports to .temp/'],
    ['--help, -h', 'Show this help'],
  ])
  process.exit(0)
}

const args = parseFlags()
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
  const migrations = checkMigrations(result)
  const flags = parseFeatureFlags()
  const featureFlags = checkFeatureFlags(flags, today, result)
  const experiments = checkExperiments(today, result)
  const dependencies = checkDependencies()
  const disasterRecovery = checkDisasterRecovery(result)
  const deadCode = checkDeadCode(result)
  const jobMonitors = checkJobMonitors(result)
  const complianceChecks = checkComplianceAutomation(result)
  const evidence = checkBacklogEvidence(backlogById, result)

  checkBacklog(backlogRows, result)
  checkBacklogSpecificity(backlogRows, result)
  checkBacklogStructure(readText('BACKLOG.md'), result)
  checkCompletedItemsOrder(readText('COMPLETED_ITEMS.md'), result)
  checkDocs(changed, result)
  checkDocumentationBudgets(result)
  checkRoadmapCoverage(result)
  checkArchitectureDrift(result)
  checkGovernanceReadiness(result)
  checkCostReadiness(result)
  checkRetryPolicy(result)
  checkAutomationRows(backlogById, result)
  checkOperationalRegisters(result)
  checkRiskReviewGovernance(result)
  checkDebtGovernance(result)
  checkBusinessInstrumentationGovernance(result)
  checkGovernanceLayerIndex(result)
  checkPrReviewAutomation(result)
  checkProductDocs(result)

  result.summary = {
    backlog: summarizeBacklog(backlogRows),
    backlogEvidence: evidence,
    changedFiles: categorizeFiles(changed),
    recentCommits: commits,
    migrations,
    featureFlags,
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
