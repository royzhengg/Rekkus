#!/usr/bin/env node
const { readText, walkFiles } = require('./lib/scan-files')
const { unsafeAnyFailures } = require('./lib/unsafe-any-rules')

const roots = ['app', 'features', 'components', 'lib', 'supabase/functions']
// This allowlist must not grow. Adding a file here requires an explicit B-### ticket
// and architectural justification. safeJson.ts is the only permanent exception.
const allowed = new Set([
  'lib/utils/safeJson.ts',
])

const failures = []

for (const file of walkFiles(roots, { extensions: ['.ts', '.tsx'] })) {
  if (allowed.has(file)) continue
  const source = readText(file)
  failures.push(...unsafeAnyFailures(file, source))
}

if (allowed.size > 1) {
  console.error(`Unsafe any allowlist has grown beyond its permitted size (${allowed.size} entries, max 1).`)
  console.error('Adding a file requires an explicit B-### ticket and architectural justification.')
  process.exit(1)
}

if (failures.length > 0) {
  console.error('Unsafe any guardrail failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Unsafe any guardrail passed.')
