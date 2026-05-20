#!/usr/bin/env bash
# Catch compact legacy icon-button style definitions. Use components/ui/IconButton.tsx
# so visual 34-40px buttons still expose a minimum 44x44pt hit target.

cd "$(dirname "$0")/.."

node <<'NODE'
const fs = require('fs')
const path = require('path')

const repoRoot = process.cwd()
const roots = ['features', 'components']
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

function compactValue(body, prop) {
  const match = body.match(new RegExp(`${prop}:\\s*(\\d+)`))
  if (!match) return null
  return Number(match[1])
}

for (const root of roots) {
  walk(path.join(repoRoot, root), (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8')
    const relative = path.relative(repoRoot, filePath)
    const styleBlock = /(iconBtn|searchFilterBtn|sheetClose)\s*:\s*\{([\s\S]*?)\n\s*\},/g
    let match

    while ((match = styleBlock.exec(source)) != null) {
      const [, styleName, body] = match
      const width = compactValue(body, 'width')
      const height = compactValue(body, 'height')
      if ((width != null && width < 44) || (height != null && height < 44)) {
        failures.push(`${relative}: ${styleName} is ${width ?? '?'}x${height ?? '?'}; use IconButton for a 44pt hit target.`)
      }
    }
  })
}

if (failures.length > 0) {
  console.error('FAIL [A11Y] Compact icon-button styles found:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Accessibility check passed.')
NODE
