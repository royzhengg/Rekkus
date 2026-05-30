#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const pkgPath = path.resolve(__dirname, '../package.json')
const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const scripts = packageJson.scripts ?? {}

// Extract all npm script names referenced by a command string.
// Handles both `npm run <name>` and `node scripts/run-parallel.js <name1> <name2> ...`
function extractScripts(command) {
  const found = new Set()
  // npm run <name>
  for (const m of command.matchAll(/npm run ([^\s&|]+)/g)) {
    found.add(m[1])
  }
  // run-parallel.js <name1> <name2> ...
  const parallelMatch = command.match(/run-parallel\.js\s+(.+)/)
  if (parallelMatch) {
    for (const name of parallelMatch[1].trim().split(/\s+/)) {
      if (name) found.add(name)
    }
  }
  return found
}

// Recursively expand a script name to all leaf scripts it calls (non-recursive guard via seen).
function expandScript(name, seen = new Set()) {
  if (seen.has(name)) return new Set()
  seen.add(name)
  const command = scripts[name]
  if (typeof command !== 'string') return new Set([name])
  const children = extractScripts(command)
  if (children.size === 0) return new Set([name])
  const all = new Set()
  for (const child of children) {
    for (const leaf of expandScript(child, new Set(seen))) {
      all.add(leaf)
    }
  }
  return all
}

// Collect direct (non-recursive) script calls from a command.
function directChildren(name) {
  const command = scripts[name]
  if (typeof command !== 'string') return new Set()
  return extractScripts(command)
}

const failures = []

// --- Rule 1: No check should appear both inside check:hygiene AND outside it in check:release ---
const hygieneChildren = expandScript('check:hygiene')

// Scripts called directly in check:release but NOT as part of check:hygiene
const releaseCommand = scripts['check:release'] ?? ''
const releaseDirectChildren = extractScripts(releaseCommand)
// Remove check:hygiene itself (it's expected)
releaseDirectChildren.delete('check:hygiene')
// Remove run-parallel (it's the runner, not a check)
releaseDirectChildren.delete('run-parallel')

for (const s of releaseDirectChildren) {
  const allLeaves = expandScript(s)
  for (const leaf of allLeaves) {
    if (hygieneChildren.has(leaf) && leaf !== 'check:pipeline') {
      failures.push(
        `Duplicate: "${leaf}" runs inside check:hygiene but also appears (via "${s}") in check:release. Remove the outer call.`
      )
    }
  }
}

// --- Rule 2: No check should appear both inside check:hygiene AND in validate:full ---
const validateFullCommand = scripts['validate:full'] ?? ''
const validateFullChildren = extractScripts(validateFullCommand)
validateFullChildren.delete('validate')
validateFullChildren.delete('check:release')
validateFullChildren.delete('run-parallel')

for (const s of validateFullChildren) {
  const allLeaves = expandScript(s)
  for (const leaf of allLeaves) {
    if (hygieneChildren.has(leaf)) {
      failures.push(
        `Duplicate: "${leaf}" runs inside check:hygiene but also appears (via "${s}") in validate:full. Remove the outer call.`
      )
    }
  }
}

// --- Rule 3: validate:full should not add direct check:* calls beyond validate + check:release ---
for (const s of validateFullChildren) {
  if (s !== 'run-parallel') {
    failures.push(
      `Outer call: "${s}" appears directly in validate:full outside of validate/check:release. Add it to check:hygiene's parallel batch instead.`
    )
  }
}

if (failures.length > 0) {
  console.error('check:pipeline: pipeline integrity check failed')
  for (const f of failures) {
    console.error(`  - ${f}`)
  }
  console.error(
    '\nAll new checks belong in the check:hygiene parallel batch. ' +
    'Do not add them to check:release or validate:full directly.'
  )
  process.exit(1)
}

console.log('check:pipeline: pipeline integrity OK')
