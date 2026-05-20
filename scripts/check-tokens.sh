#!/usr/bin/env bash
set -e
# Detects hardcoded hex/rgba color values in features/ and components/ that should use useThemeColors() tokens.
# Must exit 0 on every PR after DS-001 ships.
#
# Intentional exclusions (handled via grep -v):
#   fill=          SVG/brand colours (Google logo etc) — must stay literal
#   shadowColor    React Native platform shadow — must be '#000'
#   check:tokens-ignore  line-level escape hatch for genuinely untokenisable values

cd "$(dirname "$0")/.."

VIOLATIONS=$(grep -rnE '#[0-9a-fA-F]{3,8}|rgba\(' features/ components/ \
  | grep -v "fill=" \
  | grep -v "shadowColor" \
  | grep -v "check:tokens-ignore" \
  2>/dev/null || true)

if [ -n "$VIOLATIONS" ]; then
  echo "FAIL [TOKENS] Hardcoded hex/rgba colour values found — use useThemeColors() tokens from constants/Colors.ts:"
  echo "$VIOLATIONS"
  exit 1
fi

node <<'NODE'
const fs = require('fs')
const path = require('path')

const repoRoot = process.cwd()
const roots = ['features', 'components']

const checks = [
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

const failures = []

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, visit)
      continue
    }
    if (/\.[jt]sx?$/.test(entry.name)) visit(full)
  }
}

for (const root of roots) {
  walk(path.join(repoRoot, root), (filePath) => {
    const relative = path.relative(repoRoot, filePath)
    const lines = fs.readFileSync(filePath, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (allowed.some(token => line.includes(token))) return
      for (const check of checks) {
        if (check.regex.test(line)) {
          failures.push(`${relative}:${index + 1}: ${check.name}: ${line.trim()} — ${check.guidance}`)
        }
      }
    })
  })
}

if (failures.length > 0) {
  console.error('FAIL [TOKENS] Raw design values found:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}
NODE

echo "Token check passed."
