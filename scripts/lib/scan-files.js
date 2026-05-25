const fs = require('fs')
const path = require('path')

const DEFAULT_SLOW_READ_MS = 250

function walkFiles(roots, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd()
  const extensions = options.extensions ?? null
  const files = []

  function visit(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(full)
      } else if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(path.relative(repoRoot, full))
      }
    }
  }

  for (const root of roots) visit(path.join(repoRoot, root))
  return files
}

function readText(relativePath, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd()
  const slowReadMs = options.slowReadMs ?? DEFAULT_SLOW_READ_MS
  const fullPath = path.join(repoRoot, relativePath)
  const startedAt = Date.now()
  const source = fs.readFileSync(fullPath, 'utf8')
  const elapsed = Date.now() - startedAt
  if (elapsed > slowReadMs) {
    console.warn(`WARN [SCAN] Slow read: ${relativePath} (${elapsed}ms)`)
  }
  return source
}

function lineFailures(relativePath, source, visit) {
  const failures = []
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    const result = visit(line, index + 1, lines)
    if (!result) return
    if (Array.isArray(result)) failures.push(...result)
    else failures.push(result)
  })
  return failures
}

module.exports = {
  lineFailures,
  readText,
  walkFiles,
}
