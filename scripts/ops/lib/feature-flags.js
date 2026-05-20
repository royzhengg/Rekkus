const { listFiles, readText } = require('./files')

function parseFeatureFlags() {
  const source = readText('lib/featureFlags.ts')
  const entries = []
  const entryPattern = /^\s{2}([A-Za-z0-9_]+):\s*{\n([\s\S]*?)^\s{2}},?/gm
  let match

  while ((match = entryPattern.exec(source))) {
    const body = match[2]
    entries.push({
      name: match[1],
      enabled: /enabled:\s*true/.test(body),
      owner: field(body, 'owner'),
      state: field(body, 'state'),
      createdAt: field(body, 'createdAt'),
      reviewAt: field(body, 'reviewAt'),
      description: field(body, 'description'),
    })
  }

  return entries
}

function field(body, name) {
  const match = body.match(new RegExp(`${name}:\\s*'([^']+)'`))
  return match ? match[1] : ''
}

function referencesForFlag(flagName) {
  const files = [
    ...listFiles('app', isSourceFile),
    ...listFiles('features', isSourceFile),
    ...listFiles('components', isSourceFile),
    ...listFiles('lib', (filePath) => isSourceFile(filePath) && !filePath.endsWith('featureFlags.ts')),
  ]

  return files.filter((file) => new RegExp(`\\b${flagName}\\b`).test(readText(file)))
}

function isSourceFile(filePath) {
  return /\.[jt]sx?$/.test(filePath)
}

module.exports = {
  parseFeatureFlags,
  referencesForFlag,
}

