'use strict'
const fs = require('fs')
const path = require('path')
const { hasFlag, printHelp } = require('./lib/args')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp('check:ci-coverage', 'Verifies all required checks are wired into the CI workflow.')
  process.exit(0)
}

// Scripts that must be covered directly or through a composed workflow script.
// Extend this list when a new required check is added to AGENTS.md Required Checks.
const REQUIRED = [
  'check:docs',
  'check:hygiene',
  'check:platform',
  'check:release',
  'check:dead-code',
  'check:stale-flags',
  'check:ci-coverage',
  'check:lessons',
  'typecheck',
  'lint',
  'check:architecture',
  'check:unsafe-any',
  'test:type-safety',
  'test:unit',
  'check:coverage',
  'check:supabase-types',
  'check:circular-deps',
  'check:tokens',
  'check:darkmode',
  'check:a11y',
  'check:automation',
  'check:performance',
  'check:risk-guardrails',
  'check:hig-acceptance',
]

/**
 * Returns all npm script names referenced by a shell command string.
 * Handles `npm run <name>` and `node scripts/run-parallel.js <name1> <name2>`.
 * Pure function — exported for unit testing.
 */
function extractChildScripts(command) {
  const found = []
  for (const m of command.matchAll(/npm run ([^\s&|]+)/g)) found.push(m[1])
  // Also handle `node scripts/run-parallel.js <name1> <name2> ...`
  const parallelMatch = command.match(/run-parallel\.js\s+(.+)/)
  if (parallelMatch) {
    for (const name of parallelMatch[1].trim().split(/\s+/)) {
      if (name) found.push(name)
    }
  }
  return found
}

if (require.main === module) {
  const workflowPath = path.resolve(__dirname, '../.github/workflows/ops-checks.yml')

  if (!fs.existsSync(workflowPath)) {
    console.error('check:ci-coverage: ops-checks.yml not found at', workflowPath)
    process.exit(1)
  }

  const workflow = fs.readFileSync(workflowPath, 'utf8')
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
  const scripts = packageJson.scripts ?? {}

  const directWorkflowScripts = new Set(
    [...workflow.matchAll(/^\s*run:\s*npm run ([^\s]+).*$/gm)].map(match => match[1])
  )

  function scriptIncludedBy(parent, wanted, seen) {
    if (parent === wanted) return true
    if (seen.has(parent)) return false
    seen.add(parent)
    const command = scripts[parent]
    if (typeof command !== 'string') return false
    const nested = extractChildScripts(command)
    return nested.some(child => scriptIncludedBy(child, wanted, seen))
  }

  function coveredBy(script, seen = new Set()) {
    if (directWorkflowScripts.has(script)) return true
    if (seen.has(script)) return false
    seen.add(script)
    for (const workflowScript of directWorkflowScripts) {
      if (script === workflowScript) return true
      if (scriptIncludedBy(workflowScript, script, new Set(seen))) return true
    }
    return false
  }

  const missing = REQUIRED.filter(script => !coveredBy(script))

  if (missing.length > 0) {
    console.error('FAIL [CI-COVERAGE] These scripts are required in ops-checks.yml but are missing:')
    for (const s of missing) console.error(`  - npm run ${s}`)
    console.error('\nAdd the missing steps to .github/workflows/ops-checks.yml or include them in a composed script that runs there.')
    process.exit(1)
  }

  // Scripts that require a local tool (e.g. Supabase CLI) and hard-fail when absent.
  // They must never appear in check:release, which runs in CI without those tools.
  const CI_INCOMPATIBLE_IN_RELEASE = [
    'check:supabase-types:strict',
  ]
  const releaseCmd = scripts['check:release'] ?? ''
  const incompatible = CI_INCOMPATIBLE_IN_RELEASE.filter(s => releaseCmd.includes(s))
  if (incompatible.length > 0) {
    console.error('FAIL [CI-COVERAGE] check:release contains CI-incompatible scripts:')
    for (const s of incompatible) console.error(`  - ${s}`)
    console.error('These scripts hard-fail when their required tool is absent. Remove them from check:release or make them gracefully skip.')
    process.exit(1)
  }

  console.log('CI coverage check passed.')
}

module.exports = { extractChildScripts }
