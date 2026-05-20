const fs = require('fs')
const path = require('path')

// Scripts that must appear as `npm run <name>` in ops-checks.yml.
// Extend this list when a new required check is added to AGENTS.md Required Checks.
const REQUIRED = [
  'typecheck',
  'lint',
  'check:architecture',
  'check:tokens',
  'check:darkmode',
  'check:a11y',
]

const workflowPath = path.resolve(__dirname, '../.github/workflows/ops-checks.yml')

if (!fs.existsSync(workflowPath)) {
  console.error('check:ci-coverage: ops-checks.yml not found at', workflowPath)
  process.exit(1)
}

const workflow = fs.readFileSync(workflowPath, 'utf8')

const missing = REQUIRED.filter(script => !workflow.includes(`npm run ${script}`))

if (missing.length > 0) {
  console.error('CI coverage check failed — these scripts are required in ops-checks.yml but are missing:')
  for (const s of missing) console.error(`  - npm run ${s}`)
  console.error('\nAdd the missing steps to .github/workflows/ops-checks.yml.')
  process.exit(1)
}

console.log('CI coverage check passed.')
