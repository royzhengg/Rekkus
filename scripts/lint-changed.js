#!/usr/bin/env node
const { execFileSync, spawnSync } = require('child_process')

const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
})

const files = output
  .split('\n')
  .filter(file => /\.[jt]sx?$/.test(file))
  .filter(file => !file.startsWith('scripts/'))

if (files.length === 0) {
  console.log('No changed TypeScript files to lint.')
  process.exit(0)
}

const result = spawnSync('node_modules/.bin/eslint', ['--max-warnings=0', '--no-warn-ignored', ...files], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
