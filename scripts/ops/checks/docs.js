'use strict'
const path = require('path')
const { exists, readText, listFiles } = require('../lib/files')

function checkDocs(changed, result) {
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

function checkDocumentationBudgets(result) {
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

function checkRoadmapCoverage(result) {
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

function checkArchitectureDrift(result) {
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

function checkMigrations(result) {
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

module.exports = {
  checkDocs,
  checkDocumentationBudgets,
  checkRoadmapCoverage,
  checkArchitectureDrift,
  checkMigrations,
}
