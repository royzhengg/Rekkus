#!/usr/bin/env node
const { lineFailures, readText, walkFiles } = require('./lib/scan-files')

const patterns = [
  /backgroundColor:[\s]*['"]#[Ff]{3}['"]/,
  /backgroundColor:[\s]*['"]#[Ff]{6}['"]/,
  /backgroundColor:[\s]*['"]#[Ff][Ee][Ee]2[Ee]2['"]/,
  /backgroundColor:[\s]*['"]#[Ff][Ee][Ff]0[Ff]0['"]/,
  /backgroundColor:[\s]*'white'/,
  /backgroundColor:[\s]*"white"/,
]

const failures = []
for (const file of walkFiles(['features', 'components'], { extensions: ['.ts', '.tsx'] })) {
  const source = readText(file)
  failures.push(...lineFailures(file, source, (line, lineNumber) => {
    if (line.includes('fill=')) return null
    if (/^\s*\/\//.test(line)) return null
    if (!patterns.some(pattern => pattern.test(line))) return null
    return `${file}:${lineNumber}: ${line.trim()}`
  }))
}

if (failures.length > 0) {
  console.error('FAIL [DARKMODE] Hardcoded background colors found — use useThemeColors() tokens (c.bg, c.surface, c.errorBg, c.white):')
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Dark mode check passed.')
