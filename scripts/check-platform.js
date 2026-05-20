const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const scanRoots = ['app', 'features', 'components', 'lib']
const duplicateRoots = ['app', 'android', 'ios']
const iosOnlyPatterns = ['ActionSheetIOS', 'showActionSheetWithOptions']
const duplicateNamePattern = / [23](?:\.|$)/
const skipDirs = new Set(['node_modules', '.git', '.expo', 'Pods', 'build'])

const failures = []

function walk(relativeRoot, visitor) {
  const absoluteRoot = path.join(repoRoot, relativeRoot)

  if (!fs.existsSync(absoluteRoot)) {
    return
  }

  const stack = [absoluteRoot]

  while (stack.length) {
    const current = stack.pop()
    const stat = fs.statSync(current)
    const name = path.basename(current)

    if (stat.isDirectory()) {
      if (skipDirs.has(name)) {
        continue
      }

      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child))
      }
      continue
    }

    visitor(current)
  }
}

for (const root of scanRoots) {
  walk(root, (filePath) => {
    if (!/\.[jt]sx?$/.test(filePath)) {
      return
    }

    const source = fs.readFileSync(filePath, 'utf8')
    const matched = iosOnlyPatterns.find((pattern) => source.includes(pattern))

    if (matched) {
      failures.push(
        `${path.relative(repoRoot, filePath)} uses ${matched}; use RekkusActionSheet or a guarded Platform.OS branch.`,
      )
    }
  })
}

for (const root of duplicateRoots) {
  walk(root, (filePath) => {
    const relativePath = path.relative(repoRoot, filePath)
    const parts = relativePath.split(path.sep)

    if (parts.some((part) => duplicateNamePattern.test(part))) {
      failures.push(`${relativePath} looks like a duplicate generated/backup artifact.`)
    }
  })
}

if (failures.length > 0) {
  console.error('Platform guardrails failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Platform guardrails passed.')
