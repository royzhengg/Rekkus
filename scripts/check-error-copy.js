#!/usr/bin/env node
// Guardrail for B-403: rejects generic, non-actionable error strings.
// Add `// check-error-copy:allow` to a line only when the string is unavoidable
// and an explicit justification exists in the same PR.
const { readText, walkFiles } = require('./lib/scan-files')
const { hasFlag, printHelp } = require('./lib/args')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp('check:error-copy', 'Rejects generic error copy that does not name the failure or guide recovery.')
  process.exit(0)
}

const ROOTS = ['features', 'components']

// Each entry: { pattern, reason }
const BANNED = [
  { pattern: /['"`]Something went wrong['"`]/i, reason: '"Something went wrong" — name what failed instead' },
  { pattern: /['"`]An error occurred['"`]/i,    reason: '"An error occurred" — name what failed instead' },
  { pattern: /['"`][Uu]nexpected error['"`]/,   reason: '"unexpected error" — name what failed instead' },
  { pattern: /['"`]Failed to update/,           reason: '"Failed to update …" — use "X could not be updated. Check your connection and try again."' },
  { pattern: /['"`]Failed to save/,             reason: '"Failed to save …" — use "X could not be saved. Check your connection and try again."' },
  { pattern: /['"`]Failed to delete/,           reason: '"Failed to delete …" — use "X could not be deleted. Check your connection and try again."' },
]

const failures = []

for (const file of walkFiles(ROOTS, { extensions: ['.ts', '.tsx'] })) {
  const source = readText(file)
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('check-error-copy:allow')) return
    for (const { pattern, reason } of BANNED) {
      if (pattern.test(line)) {
        failures.push(`${file}:${i + 1} — ${reason}`)
        break
      }
    }
  })
}

if (failures.length > 0) {
  console.error('Error copy guardrail failed — replace generic strings with specific, actionable copy:')
  for (const f of failures) console.error(`  ${f}`)
  console.error('')
  console.error('See design/UX_Copywriting_Guide.md §4.3 and B-403 for the standard.')
  process.exit(1)
}

console.log('Error copy guardrail passed.')
