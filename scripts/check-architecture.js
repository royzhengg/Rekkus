#!/usr/bin/env node
const fs = require('fs')
const { readText, walkFiles } = require('./lib/scan-files')
const { serviceBoundaryFailures } = require('./lib/service-boundary-rules')

let failed = false
let warned = false

const locAllowlist = new Set([
  // B-282: dish resolution (+15 LOC) pushed CreatePostScreen over 600; extract handlePost helpers to reduce — B-282
  'features/create-post/CreatePostScreen.tsx',
])
const sharedLocAllowlist = new Map()
const supabaseAllowlist = new Map()

function lineCount(source) {
  if (source.length === 0) return 0
  return source.split('\n').length
}

function warn(message) {
  console.warn(message)
  warned = true
}

function checkSharedBudget(roots, softLimit) {
  for (const file of walkFiles(roots, { extensions: ['.ts', '.tsx'] })) {
    const lines = lineCount(readText(file))
    if (lines <= softLimit) continue
    const reason = sharedLocAllowlist.get(file)
    if (!reason) {
      console.error(`FAIL [LOC] ${file}: ${lines} lines (shared-file ratchet limit: ${softLimit}; add a backlog item before extending).`)
      failed = true
      continue
    }
    warn(`WARN [LOC] ${file}: ${lines} lines (${reason})`)
  }
}

for (const [file, reason] of sharedLocAllowlist) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL [ALLOWLIST] ${file}: shared LOC allowlist entry points to a missing file.`)
    failed = true
    continue
  }
  if (!/^B-\d+/.test(reason)) {
    console.error(`FAIL [ALLOWLIST] ${file}: shared LOC allowlist entries need a backlog ID and reason.`)
    failed = true
  }
  if (lineCount(readText(file)) <= 600) {
    console.error(`FAIL [ALLOWLIST] ${file}: shared LOC debt is below the ratchet threshold; remove its allowlist entry.`)
    failed = true
  }
}

for (const file of supabaseAllowlist.keys()) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL [ALLOWLIST] ${file}: Supabase allowlist entry points to a missing file.`)
    failed = true
  }
  const reason = supabaseAllowlist.get(file)
  if (!reason || !/^B-\d+/.test(reason)) {
    console.error(`FAIL [ALLOWLIST] ${file}: Supabase allowlist entries need a backlog ID and reason.`)
    failed = true
  }
  for (const failure of serviceBoundaryFailures(file, readText(file), true)) {
    console.error(failure)
    failed = true
  }
}

for (const file of walkFiles(['features'], { extensions: ['.ts', '.tsx'] })) {
  const lines = lineCount(readText(file))
  if (lines > 400) {
    warn(`WARN [LOC] ${file}: ${lines} lines (soft budget: 400; hard limit: 600)`)
  }
  if (lines > 600 && !locAllowlist.has(file)) {
    console.error(`FAIL [LOC] ${file}: ${lines} lines (hard limit: 600)`)
    failed = true
  }
}

for (const file of walkFiles(['lib/hooks'], { extensions: ['.ts', '.tsx'] })) {
  const lines = lineCount(readText(file))
  if (lines > 200) {
    warn(`WARN [LOC] ${file}: ${lines} lines (soft budget: 200; hard limit: 600)`)
  }
  if (lines > 600) {
    console.error(`FAIL [LOC] ${file}: ${lines} lines (hard limit: 600)`)
    failed = true
  }
}

checkSharedBudget(['components'], 600)
checkSharedBudget(['lib/services'], 600)

for (const file of walkFiles(['features', 'app', 'lib/hooks', 'lib/contexts'], { extensions: ['.ts', '.tsx'] })) {
  for (const failure of serviceBoundaryFailures(file, readText(file), supabaseAllowlist.has(file))) {
    console.error(failure)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(warned ? 'Architecture check passed with advisory warnings.' : 'Architecture check passed.')
