#!/usr/bin/env node
const fs = require('fs')

const required = [
  ['TypeScript compiler', 'node_modules/typescript/bin/tsc'],
  ['ESLint binary', 'node_modules/eslint/bin/eslint.js'],
  ['lint-staged binary', 'node_modules/.bin/lint-staged'],
  ['Husky pre-commit hook', '.husky/pre-commit'],
  ['Husky commit-msg hook', '.husky/commit-msg'],
  ['Expo CLI', 'node_modules/.bin/expo'],
  ['architecture check', 'scripts/check-architecture.sh'],
  ['unsafe-any check', 'scripts/check-unsafe-any.js'],
  ['circular dependency check', 'scripts/check-circular-deps.js'],
  ['token check', 'scripts/check-tokens.sh'],
  ['dark-mode check', 'scripts/check-darkmode.sh'],
  ['a11y check', 'scripts/check-a11y.sh'],
]

const missing = required.filter(([, file]) => !fs.existsSync(file))

if (missing.length > 0) {
  console.error('FAIL [TOOLING] Missing required local tooling:')
  for (const [label, file] of missing) console.error(`- ${label}: ${file}`)
  process.exit(1)
}

console.log('Tooling check passed.')
