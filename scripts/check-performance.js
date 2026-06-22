#!/usr/bin/env node
const { spawnSync } = require('child_process')
const { readText, walkFiles } = require('./lib/scan-files')

const hardFeatureLimit = 600
// B-509: searchScoring.perf.test.ts deleted (scoring pipeline replaced by vector search).
// New perf test guards embedding pipeline and semantic search response time.
const searchPerfTestPath = 'tests/unit/lib/search/semantic.perf.test.ts'
const failures = []
const warnings = []

// Files exceeding the hard limit that have a tracked backlog item.
// Each entry must include a backlog ID and a reason.
// Remove the entry once the file is back under the limit.
const locAllowlist = new Map([
  // B-282: dish resolution (+15 LOC) pushed CreatePostScreen over 600; extract handlePost helpers to reduce — B-282
  ['features/create-post/CreatePostScreen.tsx', 'B-282'],
  // B-239b: offline mutation handlers and syncEpoch subscriptions added to messaging inbox — B-239b
  ['features/messages/MessagesListScreen.tsx', 'B-239b'],
  // B-239: explicit offline recovery covers rich message submissions in the existing composer — B-239
  ['features/messages/MessageInput.tsx', 'B-239'],
  // B-282: dish detail additions pushed PostDetailScreen over 600; extract detail panels to reduce — B-282
  ['features/posts/PostDetailScreen.tsx', 'B-282'],
  // B-239: place save and governance recovery remain coordinated in the existing detail workflow — B-239
  ['features/restaurants/RestaurantDetailScreen.tsx', 'B-239'],
  // B-239: saved-place intent sync remains coordinated in the existing places tab workflow — B-239
  ['features/restaurants/RestaurantsTabScreen.tsx', 'B-239'],
  // B-568: search enrichment (trending user_count, dish intent, engagement signals) pushed SearchScreen over 600; extract discovery hooks to reduce — B-568
  ['features/search/SearchScreen.tsx', 'B-568'],
  // B-570: unified SearchCandidate ranking and diversity pass added to SearchResultsTab; extract ranking hooks to reduce — B-570
  ['features/search/SearchResultsTab.tsx', 'B-570'],
])

function lineCount(source) {
  if (source.length === 0) return 0
  return source.split('\n').length
}

function warnMemoization(file, source) {
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (!/useMemo\s*\(/.test(line)) return

    const window = lines.slice(index, Math.min(lines.length, index + 8)).join('\n')
    const emptyDeps = /\]\s*\)\s*$/.test(window) && /,\s*\[\s*\]/.test(window)
    const staticLiteral =
      /useMemo\s*\(\s*\(\)\s*=>\s*(?:\[[\s\S]*?\]|\{[\s\S]*?\})\s*,\s*\[\s*\]/.test(window)
    const mockData = /Object\.(?:entries|values|keys)\(demo[A-Z]/.test(window)

    if (emptyDeps || staticLiteral || mockData) {
      warnings.push(
        `WARN [MEMO] ${file}:${index + 1}: review likely non-reactive constant-data memoization. Prefer module constants unless derived from props/state.`
      )
    }
  })
}

function runSearchLatencyBudget() {
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('jest/bin/jest'),
      '--runInBand',
      '--runTestsByPath',
      searchPerfTestPath,
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' },
    }
  )

  if (result.status === 0) return

  const reason = result.signal
    ? `terminated by ${result.signal}`
    : `exited with status ${result.status ?? 'unknown'}`
  failures.push(`FAIL [SEARCH_LATENCY] ${searchPerfTestPath}: ${reason}`)
}

for (const file of walkFiles(['features'], { extensions: ['.ts', '.tsx'] })) {
  const source = readText(file)
  const lines = lineCount(source)
  if (lines > hardFeatureLimit) {
    const ticket = locAllowlist.get(file)
    if (ticket) {
      warnings.push(`WARN [LOC] ${file}: ${lines} lines (hard limit: ${hardFeatureLimit}; allowed by ${ticket})`)
    } else {
      failures.push(`FAIL [LOC] ${file}: ${lines} lines (hard limit: ${hardFeatureLimit})`)
    }
  }
  warnMemoization(file, source)
}

runSearchLatencyBudget()

for (const warning of warnings) console.warn(warning)

if (failures.length > 0) {
  console.error('Performance guardrails failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  warnings.length > 0
    ? 'Performance check passed with advisory warnings.'
    : 'Performance check passed.'
)
