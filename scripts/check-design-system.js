#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const roots = ['features', 'components']
const allowedFiles = new Set(['components/ui/Chip.tsx'])
const bannedPatterns = [
  'EmptyTabText',
  'BellEmptyIcon',
  'EmptyPinIcon',
  'inlineEmpty',
  'suggestionPill',
  'quickStartChip',
  'radiusSheetChip',
  'sheetChoiceChip',
  'trendingPill',
  'newPostsPill',
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
    const rel = path.relative(repoRoot, filePath)
    if (allowedFiles.has(rel)) return
    const source = fs.readFileSync(filePath, 'utf8')
    for (const pattern of bannedPatterns) {
      if (source.includes(pattern)) {
        failures.push(`${rel}: "${pattern}" should use EmptyState or Chip instead.`)
      }
    }
  })
}

if (failures.length > 0) {
  console.error('FAIL [DESIGN SYSTEM] Custom empty/chip patterns found:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Design system check passed.')

