#!/usr/bin/env node
const { lineFailures, readText, walkFiles } = require('./lib/scan-files')
const { fontSizeFailures } = require('./lib/font-size-rules')

const sourceFiles = walkFiles(['features', 'components'], { extensions: ['.ts', '.tsx', '.js', '.jsx'] })
// Also scan app/ and lib/contexts/ for typography token violations (B-527 guardrail).
// Colors and spacing are intentionally not extended here — those dirs have legitimate platform values.
const typographyOnlyFiles = walkFiles(['app', 'lib/contexts'], { extensions: ['.ts', '.tsx', '.js', '.jsx'] })

const colorPattern = /#[0-9a-fA-F]{3,8}|rgba\(/
const rawChecks = [
  {
    name: 'border radius',
    regex: /\bborder(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius:\s*\d+/,
    guidance: 'use radius tokens from constants/Radius.ts',
  },
  {
    name: 'spacing',
    regex: /\b(?:padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft|gap):\s*-?\d+/,
    guidance: 'use spacing tokens from constants/Spacing.ts',
  },
  {
    name: 'typography',
    regex: /\b(?:fontSize|fontWeight|lineHeight):\s*(?:\d+|['"](?:[1-9]00)['"])/,
    guidance: 'use semantic presets or primitives from constants/Typography.ts',
  },
]

const allowed = [
  'check:tokens-ignore',
  'size / 2',
  'AVATAR_SIZE / 2',
  '...body',
  '...label',
  '...caption',
]

const colorFailures = []
const rawFailures = []
const fontSizeFailuresList = []

// Loop 1: features + components — colour, spacing/radius/typography, font-size (single read per file)
for (const file of sourceFiles) {
  const source = readText(file)

  colorFailures.push(...lineFailures(file, source, (line) => {
    if (!colorPattern.test(line)) return null
    if (line.includes('fill=')) return null
    if (line.includes('shadowColor')) return null
    if (line.includes('check:tokens-ignore')) return null
    return `${file}: ${line.trim()}`
  }))

  rawFailures.push(...lineFailures(file, source, (line) => {
    if (allowed.some(token => line.includes(token))) return null
    for (const check of rawChecks) {
      if (check.regex.test(line)) {
        return `${file}: ${check.name}: ${line.trim()} — ${check.guidance}`
      }
    }
    return null
  }))

  fontSizeFailuresList.push(...fontSizeFailures(file, source))
}

// Loop 2: app + lib/contexts — typography + font-size only (single read per file)
const typographyCheck = rawChecks.find(c => c.name === 'typography')
for (const file of typographyOnlyFiles) {
  const source = readText(file)

  if (typographyCheck) {
    rawFailures.push(...lineFailures(file, source, (line) => {
      if (allowed.some(token => line.includes(token))) return null
      if (typographyCheck.regex.test(line)) {
        return `${file}: ${typographyCheck.name}: ${line.trim()} — ${typographyCheck.guidance}`
      }
      return null
    }))
  }

  fontSizeFailuresList.push(...fontSizeFailures(file, source))
}

if (colorFailures.length > 0) {
  console.error('FAIL [TOKENS] Hardcoded hex/rgba colour values found — use useThemeColors() tokens from constants/Colors.ts:')
  console.error(colorFailures.join('\n'))
  process.exit(1)
}

if (rawFailures.length > 0) {
  console.error('FAIL [TOKENS] Raw design values found:')
  for (const failure of rawFailures) console.error(`- ${failure}`)
  process.exit(1)
}

if (fontSizeFailuresList.length > 0) {
  console.error('FAIL [TOKENS] Minimum font size violations found — fontSize must be ≥ 12 (B-532):')
  for (const failure of fontSizeFailuresList) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Token check passed.')
