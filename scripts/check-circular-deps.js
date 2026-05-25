#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { readText, walkFiles } = require('./lib/scan-files')

const repoRoot = process.cwd()
const roots = ['app', 'features', 'components', 'constants', 'lib', 'types']
const extensions = ['.ts', '.tsx']
const indexFiles = extensions.map(ext => `index${ext}`)
const files = new Set(walkFiles(roots, { extensions }))
const graph = new Map()

for (const file of files) {
  const source = stripComments(readText(file))
  const imports = new Set()
  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveImport(file, specifier)
    if (resolved && files.has(resolved)) imports.add(resolved)
  }
  graph.set(file, [...imports])
}

const cycles = []
const visiting = new Set()
const visited = new Set()
const stack = []

function visit(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file)
    if (start >= 0) cycles.push([...stack.slice(start), file])
    return
  }
  if (visited.has(file)) return

  visiting.add(file)
  stack.push(file)
  for (const next of graph.get(file) ?? []) visit(next)
  stack.pop()
  visiting.delete(file)
  visited.add(file)
}

for (const file of graph.keys()) visit(file)

const uniqueCycles = [...new Map(cycles.map(cycle => [canonicalCycle(cycle), cycle])).values()]

if (uniqueCycles.length > 0) {
  console.error('Circular dependency guardrail failed:')
  for (const cycle of uniqueCycles) console.error(`- ${cycle.join(' -> ')}`)
  process.exit(1)
}

console.log('Circular dependency guardrail passed.')

function importSpecifiers(source) {
  const specs = []
  const patterns = [
    /import\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?[^'"]+?\s+from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.push(match[1])
  }
  return specs
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/')
    ? path.join(repoRoot, specifier.slice(2))
    : path.resolve(repoRoot, path.dirname(fromFile), specifier)

  for (const ext of extensions) {
    const file = `${base}${ext}`
    if (fs.existsSync(file)) return path.relative(repoRoot, file)
  }

  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const indexFile of indexFiles) {
      const file = path.join(base, indexFile)
      if (fs.existsSync(file)) return path.relative(repoRoot, file)
    }
  }

  return null
}

function canonicalCycle(cycle) {
  const withoutRepeat = cycle.slice(0, -1)
  const rotations = withoutRepeat.map((_, index) => [
    ...withoutRepeat.slice(index),
    ...withoutRepeat.slice(0, index),
  ])
  return rotations.map(rotation => rotation.join(' -> ')).sort()[0]
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
}
