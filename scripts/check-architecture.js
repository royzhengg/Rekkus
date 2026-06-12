#!/usr/bin/env node
const fs = require('fs')
const { readText, walkFiles } = require('./lib/scan-files')
const { serviceBoundaryFailures } = require('./lib/service-boundary-rules')
const { hasFlag, printHelp } = require('./lib/args')

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp('check:architecture', 'Enforces file-size ratchets, allowlists, and service boundary rules.')
  process.exit(0)
}

let failed = false
let warned = false

const locAllowlist = new Set([
  // B-239: reversible inbox preference sync remains coordinated in the existing conversation list workflow.
  'features/messages/MessagesListScreen.tsx',
  // B-239: place save and governance recovery remain coordinated in the existing detail workflow.
  'features/restaurants/RestaurantDetailScreen.tsx',
  // B-239: saved-place intent sync remains coordinated in the existing places tab workflow.
  'features/restaurants/RestaurantsTabScreen.tsx',
  // B-282: dish detail additions pushed PostDetailScreen over 600; extract detail panels to reduce — B-282
  'features/posts/PostDetailScreen.tsx',
  // B-568: search enrichment (trending user_count, dish intent, engagement signals) pushed SearchScreen over 600; extract discovery hooks to reduce — B-568
  'features/search/SearchScreen.tsx',
  // B-570: unified SearchCandidate ranking and diversity pass added to SearchResultsTab; extract ranking hooks to reduce — B-570
  'features/search/SearchResultsTab.tsx',
])
const sharedLocAllowlist = new Map([
  // B-405: dish tag onboarding tooltip added first-time disclosure; extract tag modal to reduce — B-405
  ['components/post-create/StepMedia.tsx', 'B-405: dish tag onboarding tooltip added first-time disclosure; extract tag modal to reduce — B-405'],
  // B-587/B-588: place stub cache + food category Text Search added; extract provider helpers to reduce — B-587
  ['lib/services/restaurants.ts', 'B-587/B-588: place stub cache + food category Text Search added; extract provider helpers to reduce — B-587'],
])
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

// Guardrail: MessageList FlatList must handle initial scroll independently of isAtBottom.
// Without needsInitialScroll, an initial onScroll event at y=0 sets isAtBottom=false before
// onContentSizeChange fires, so the auto-scroll to latest message silently never runs.
const messageListSrc = readText('features/messages/MessageList.tsx')
if (!messageListSrc.includes('needsInitialScroll.current')) {
  console.error('FAIL [SCROLL] features/messages/MessageList.tsx: FlatList onContentSizeChange must include needsInitialScroll.current bypass so entering a conversation always lands at the latest message.')
  failed = true
}

if (failed) process.exit(1)
console.log(warned ? 'Architecture check passed with advisory warnings.' : 'Architecture check passed.')
