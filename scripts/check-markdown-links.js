const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const skipDirs = new Set(['.git', '.expo', 'node_modules', 'Pods', 'build'])
const failures = []

function walk(dir, visitor) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, visitor)
      continue
    }
    visitor(fullPath)
  }
}

function isExternal(link) {
  return /^(?:https?:|mailto:|tel:|sms:|#)/.test(link)
}

function stripFragment(link) {
  return link.split('#')[0]
}

function isExistingTarget(baseDir, rawTarget) {
  const decoded = decodeURI(stripFragment(rawTarget))
  if (!decoded) return true
  const absolute = path.resolve(baseDir, decoded)
  return fs.existsSync(absolute)
}

walk(repoRoot, (filePath) => {
  if (!filePath.endsWith('.md')) return

  const source = fs.readFileSync(filePath, 'utf8')
  const relativeFile = path.relative(repoRoot, filePath)
  const baseDir = path.dirname(filePath)
  const linkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)/g
  let match

  while ((match = linkPattern.exec(source))) {
    const link = match[1]
    if (isExternal(link)) continue
    if (!isExistingTarget(baseDir, link)) {
      failures.push(`${relativeFile} links to missing markdown target: ${link}`)
    }
  }
})

if (failures.length > 0) {
  console.error('Markdown link checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Markdown link checks passed.')
