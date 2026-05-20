#!/usr/bin/env node
const path = require('path')
const { listFiles, readText } = require('./lib/files')

const sourceFiles = [
  ...listFiles('components', (filePath) => /\.[jt]sx?$/.test(filePath)),
  ...listFiles('lib', (filePath) => /\.[jt]sx?$/.test(filePath)),
  ...listFiles('constants', (filePath) => /\.[jt]sx?$/.test(filePath)),
  ...listFiles('types', (filePath) => /\.[jt]sx?$/.test(filePath)),
]

const searchableFiles = [
  ...listFiles('app', (filePath) => /\.[jt]sx?$/.test(filePath)),
  ...listFiles('features', (filePath) => /\.[jt]sx?$/.test(filePath)),
  ...sourceFiles,
]

const searchableText = searchableFiles.map((file) => readText(file)).join('\n')
const ignored = new Set([
  'lib/config.ts',
  'lib/supabase.ts',
  'types/database.ts',
])

const candidates = []

for (const file of sourceFiles) {
  if (ignored.has(file)) continue
  const basename = path.basename(file, path.extname(file))
  const source = readText(file)

  if (!/\bexport\b/.test(source)) continue
  if (new RegExp(`from ['"]@?/?[^'"]*${escapeRegExp(basename)}['"]`).test(searchableText)) continue
  if (new RegExp(`import\\([^)]*${escapeRegExp(basename)}`).test(searchableText)) continue

  candidates.push(file)
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ candidates }, null, 2)}\n`)
} else if (candidates.length) {
  process.stdout.write('Potential dead-code candidates found. Review manually before deleting:\n')
  for (const candidate of candidates) process.stdout.write(`- ${candidate}\n`)
} else {
  process.stdout.write('No conservative dead-code candidates found.\n')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

