const SCANNED_DIRS = /^(?:features|components|app|lib\/contexts)\//
const MIN_FONT_SIZE = 12

function fontSizeFailures(relativePath, source) {
  const failures = []
  if (!SCANNED_DIRS.test(relativePath) || !/\.[jt]sx?$/.test(relativePath)) return failures

  const fontSizeLiteral = /\bfontSize:\s*(\d+(?:\.\d+)?)/g
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    fontSizeLiteral.lastIndex = 0
    let m
    while ((m = fontSizeLiteral.exec(line)) !== null) {
      const value = parseFloat(m[1])
      if (value < MIN_FONT_SIZE) {
        failures.push(
          `${relativePath}:${i + 1}: [MIN_FONT_SIZE] fontSize ${value} is below minimum ${MIN_FONT_SIZE} — use tokens from constants/Typography.ts (smallest allowed: bodySm: 12)`
        )
      }
    }
  })
  return failures
}

module.exports = { fontSizeFailures }
