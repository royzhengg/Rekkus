const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '../../..')
const skipDirs = new Set([
  '.git',
  '.expo',
  '.temp',
  'node_modules',
  'Pods',
  'build',
  'dist',
  'web-build',
])

function repoPath(...parts) {
  return path.join(repoRoot, ...parts)
}

function relative(filePath) {
  return path.relative(repoRoot, filePath)
}

function readText(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath))
}

function walk(relativeRoot, visitor) {
  const absoluteRoot = repoPath(relativeRoot)
  if (!fs.existsSync(absoluteRoot)) return

  const stack = [absoluteRoot]
  while (stack.length) {
    const current = stack.pop()
    const name = path.basename(current)
    const stat = fs.statSync(current)

    if (stat.isDirectory()) {
      if (skipDirs.has(name)) continue
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child))
      continue
    }

    visitor(current)
  }
}

function listFiles(relativeRoot, predicate = () => true) {
  const files = []
  walk(relativeRoot, (filePath) => {
    if (predicate(filePath)) files.push(relative(filePath))
  })
  return files.sort()
}

module.exports = {
  exists,
  listFiles,
  readJson,
  readText,
  relative,
  repoPath,
  repoRoot,
  walk,
}

