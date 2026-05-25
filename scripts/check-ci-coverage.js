const fs = require('fs')
const path = require('path')

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
]

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

function scriptIncludedBy(parent, wanted, seen) {
  if (parent === wanted) return true
  if (seen.has(parent)) return false
  seen.add(parent)
  const command = scripts[parent]
  if (typeof command !== 'string') return false
  const nested = [...command.matchAll(/npm run ([^\s&|]+)/g)].map(match => match[1])
  return nested.some(child => scriptIncludedBy(child, wanted, seen))
}

const missing = REQUIRED.filter(script => !coveredBy(script))

if (missing.length > 0) {
  console.error('CI coverage check failed — these scripts are required in ops-checks.yml but are missing:')
  for (const s of missing) console.error(`  - npm run ${s}`)
  console.error('\nAdd the missing steps to .github/workflows/ops-checks.yml or include them in a composed script that runs there.')
  process.exit(1)
}

console.log('CI coverage check passed.')
