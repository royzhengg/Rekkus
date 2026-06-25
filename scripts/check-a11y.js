#!/usr/bin/env node
const { readText, walkFiles } = require('./lib/scan-files')

const failures = []
const CONTRAST_MIN = 4.5
const legacyImageAllowlist = new Set([
  'components/post-create/DraggableMediaStrip.tsx',
  'components/post-create/DraggablePhotoStrip.tsx',
  'components/post-create/StepMedia.tsx',
  'features/settings/Enable2FAScreen.tsx', // QR code is a data-URI SVG; no caching needed; onError fallback required
])

// B-534: all screens remediated — allowlist now empty.
const textRoleLegacyAllowlist = new Set()

function extractThemeColors(themeName) {
  const source = readText('constants/Colors.ts')
  const match = source.match(new RegExp(`export const ${themeName}Colors = \\{([\\s\\S]*?)\\n\\}`))
  if (!match) {
    failures.push(`constants/Colors.ts: missing ${themeName}Colors export.`)
    return {}
  }

  const colors = {}
  for (const line of match[1].split('\n')) {
    const token = line.match(/^\s*([A-Za-z0-9]+):\s*['"]([^'"]+)['"]/)
    if (token) colors[token[1]] = token[2]
  }
  return colors
}

function parseColor(color) {
  if (!color) return null

  const hex = color.match(/^#([0-9A-Fa-f]{6})$/)
  if (hex) {
    return [0, 2, 4].map(index => parseInt(hex[1].slice(index, index + 2), 16))
  }

  const rgba = color.match(/^rgba\((\d+),(\d+),(\d+),([01]?(?:\.\d+)?)\)$/)
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])]
  }

  return null
}

function toHex(rgb) {
  return `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function blendColor(foreground, background) {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg || fg.length !== 4) return foreground

  return toHex(fg.slice(0, 3).map((value, index) => Math.round(value * fg[3] + bg[index] * (1 - fg[3]))))
}

function relativeLuminance(color) {
  const rgb = parseColor(color)
  if (!rgb) return null

  const [red, green, blue] = rgb.slice(0, 3).map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrastRatio(foreground, background) {
  const fg = relativeLuminance(foreground)
  const bg = relativeLuminance(background)
  if (fg === null || bg === null) return null

  const lighter = Math.max(fg, bg)
  const darker = Math.min(fg, bg)
  return (lighter + 0.05) / (darker + 0.05)
}

function reportContrast(themeName, foregroundToken, backgroundToken, foreground, background) {
  const ratio = contrastRatio(foreground, background)
  if (ratio === null) {
    failures.push(`constants/Colors.ts: ${themeName} ${foregroundToken} on ${backgroundToken} uses an unsupported color format.`)
  } else if (ratio < CONTRAST_MIN) {
    failures.push(`constants/Colors.ts: ${themeName} ${foregroundToken} on ${backgroundToken} contrast is ${ratio.toFixed(2)}:1; minimum is ${CONTRAST_MIN}:1.`)
  }
}

function reportThemeContrast(themeName, colors) {
  const neutralBackgrounds = ['bg', 'surface', 'surface2', 'errorBg', 'ratingBg']
  for (const foregroundToken of ['text', 'text2', 'text3']) {
    for (const backgroundToken of neutralBackgrounds) {
      reportContrast(themeName, foregroundToken, backgroundToken, colors[foregroundToken], colors[backgroundToken])
    }
  }

  reportContrast(themeName, 'chipDefaultText', 'chipDefaultBg', colors.chipDefaultText, colors.chipDefaultBg)
  reportContrast(themeName, 'ratingText', 'ratingBg', colors.ratingText, colors.ratingBg)
  reportContrast(themeName, 'errorText', 'errorBg', colors.errorText, colors.errorBg)

  for (const baseToken of ['bg', 'surface', 'surface2']) {
    reportContrast(
      themeName,
      'chipActiveText',
      `chipActiveBg over ${baseToken}`,
      colors.chipActiveText,
      blendColor(colors.chipActiveBg, colors[baseToken]),
    )
  }
}

function hasCompactLegacyStyle(source) {
  const blocks = source.match(/(iconBtn|searchFilterBtn|sheetClose)\s*:\s*\{[^}]*\}/g) ?? []
  return blocks.some(block => /(width|height):\s*([0-3]?\d|4[0-3])\b/.test(block))
}

function reportTextOnlyButtonsMissingRole(relative, source) {
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!/<(TouchableOpacity|Pressable)\b/.test(line)) continue
    const end = lines.findIndex((candidate, index) => index >= i && /<\/(TouchableOpacity|Pressable)>/.test(candidate))
    const chunk = lines.slice(i, end >= i ? end + 1 : Math.min(i + 10, lines.length)).join('\n')
    // Skip self-closing elements — they have no text children to audit
    if (/<(TouchableOpacity|Pressable)\b[^>]*\/>/.test(chunk.slice(0, 500))) continue
    if (!(/onPress/.test(chunk))) continue
    if (!/<Text\b/.test(chunk)) continue
    if (/<(?:[A-Z][A-Za-z0-9]*Icon|ArrowLeft|ChevronLeft|CloseIcon|DotsIcon|SearchIcon|FilterIcon|SendIcon|BookmarkIcon|HeartIcon|ShareIcon|CameraIcon|PinIcon|PhoneIcon|SortIcon|PlusIcon)\b/.test(chunk)) continue
    if (/accessibilityRole=/.test(chunk)) continue
    failures.push(`${relative}:${i + 1}: interactive text element needs accessibilityRole (required for VoiceOver and TalkBack).`)
  }
}

function reportIconOnlyButtons(relative, source) {
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!/<(TouchableOpacity|Pressable)\b/.test(line)) continue
    const end = lines.findIndex((candidate, index) => index >= i && /<\/(TouchableOpacity|Pressable)>/.test(candidate))
    const chunk = lines.slice(i, end >= i ? end + 1 : Math.min(i + 8, lines.length)).join('\n')
    if (!/<(?:[A-Z][A-Za-z0-9]*Icon|ArrowLeft|ChevronLeft|CloseIcon|DotsIcon|SearchIcon|FilterIcon|SendIcon|BookmarkIcon|HeartIcon|ShareIcon|CameraIcon|PinIcon|PhoneIcon|SortIcon|PlusIcon)\b/.test(chunk)) continue
    if (/<Text\b/.test(chunk)) continue
    if (!/accessibilityLabel=/.test(chunk)) {
      failures.push(`${relative}:${i + 1}: icon-only button needs accessibilityLabel.`)
    }
  }
}

for (const relative of walkFiles(['features', 'components'], { extensions: ['.ts', '.tsx'] })) {
  const source = readText(relative)
  if (hasCompactLegacyStyle(source)) {
    failures.push(`${relative}: compact legacy icon-button style found; use IconButton or a 44pt hit target.`)
  }
  reportIconOnlyButtons(relative, source)
  if (!textRoleLegacyAllowlist.has(relative)) {
    reportTextOnlyButtonsMissingRole(relative, source)
  }
  if (
    !legacyImageAllowlist.has(relative) &&
    /import\s*\{[^}]*\bImage\b[^}]*\}\s*from ['"]react-native['"]/.test(source)
  ) {
    failures.push(`${relative}: use CachedImage for visible remote images; legacy Image is only allowlisted for local media editors.`)
  }
}

reportThemeContrast('light', extractThemeColors('light'))
reportThemeContrast('dark', extractThemeColors('dark'))

if (failures.length > 0) {
  console.error('FAIL [A11Y]')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Accessibility check passed.')
