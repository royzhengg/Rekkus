#!/usr/bin/env node
// Fails if any flag in lib/featureFlags.ts has no isEnabled() call site in source files.
// Run after adding a new flag to ensure it is actually gated before merging.
const path = require('path')
const { listFiles, readText } = require('./lib/files')

const flagsSource = readText('lib/featureFlags.ts')
const allowlist = new Map()

// Extract all flag keys from the `const flags = { ... }` object
const flagKeyPattern = /^\s{2}(\w+):\s*\{/gm
const flagKeys = []
let match
while ((match = flagKeyPattern.exec(flagsSource)) !== null) {
  flagKeys.push(match[1])
}

if (flagKeys.length === 0) {
  process.stderr.write('check:stale-flags: could not parse any flag keys from lib/featureFlags.ts\n')
  process.exit(1)
}

const searchDirs = ['app', 'features', 'lib/hooks', 'lib/contexts', 'lib/services', 'lib/utils', 'components']
const searchFiles = searchDirs.flatMap(dir =>
  listFiles(dir, (filePath) => /\.[jt]sx?$/.test(filePath)).filter(f => f !== 'lib/featureFlags.ts')
)
const searchableText = searchFiles.map(f => readText(f)).join('\n')

const stale = flagKeys.filter(key => {
  const single = `isEnabled('${key}')`
  const double = `isEnabled("${key}")`
  return !searchableText.includes(single) && !searchableText.includes(double)
})

const failures = []
for (const key of stale) {
  if (!allowlist.has(key)) {
    failures.push(`Feature flag ${key} has no isEnabled() call site and is not tracked in BACKLOG.md.`)
  }
}
for (const [key, reason] of allowlist) {
  if (!flagKeys.includes(key)) {
    failures.push(`Feature flag allowlist entry ${key} is obsolete; remove it.`)
  } else if (!stale.includes(key)) {
    failures.push(`Feature flag ${key} is used again; remove its stale-flag allowlist entry.`)
  }
  if (!/^B-\d+/.test(reason)) {
    failures.push(`Feature flag allowlist entry ${key} needs a BACKLOG.md ID.`)
  }
}

if (failures.length > 0) {
  process.stderr.write(
    'check:stale-flags failed:\n' +
    failures.map(failure => `  - ${failure}`).join('\n') + '\n'
  )
  process.exit(1)
}

process.stdout.write(
  `check:stale-flags: passed (${stale.length} backlog-tracked unreferenced flag(s); new violations fail).\n`
)
