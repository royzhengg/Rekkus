#!/usr/bin/env node
const { readText, walkFiles } = require('./lib/scan-files')

const hardFeatureLimit = 600
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
