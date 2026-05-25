#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { errorSurfaceFailures } = require('./lib/error-surface-rules')
const { loadingSurfaceFailures } = require('./lib/loading-surface-rules')

const repoRoot = path.resolve(__dirname, '..')
const roots = ['features', 'components']
const allowedFiles = new Set(['components/ui/Chip.tsx'])
const bannedPatterns = [
  'EmptyTabText',
  'BellEmptyIcon',
  'EmptyPinIcon',
  'inlineSkeleton',
  'customSkeleton',
  'skeletonBox',
  'postCardSkeleton',
  'feedCardSkeleton',
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
    failures.push(...errorSurfaceFailures(rel, source))
    failures.push(...loadingSurfaceFailures(rel, source))
    for (const pattern of bannedPatterns) {
      if (source.includes(pattern)) {
        failures.push(`${rel}: "${pattern}" should use EmptyState or Chip instead.`)
      }
    }
    if (/(shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation\s*:)/.test(source)) {
      failures.push(`${rel}: raw shadow/elevation styles should use constants/Elevation.ts.`)
    }
  })
}

if (failures.length > 0) {
  console.error('FAIL [DESIGN SYSTEM] Non-canonical UI patterns found:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Design system check passed.')
