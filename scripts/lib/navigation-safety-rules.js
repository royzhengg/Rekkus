const allowedHardwareBackHandlers = new Map([
  [
    'features/create-post/CreatePostScreen.tsx',
    'B-534: Android back delegates to the create flow step/draft-confirm handler.',
  ],
])

function openingTag(source, start) {
  let braceDepth = 0
  let quote = null
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const character = source[index]

    if (quote !== null) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
    } else if (character === '{') {
      braceDepth += 1
    } else if (character === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
    } else if (character === '>' && braceDepth === 0) {
      return source.slice(start, index + 1)
    }
  }

  return source.slice(start)
}

function navigationSafetyFailures(relativePath, source) {
  const failures = []
  const protectedFile = /^(?:app|features|components)\//.test(relativePath)
  if (!protectedFile || !/\.[jt]sx?$/.test(relativePath)) return failures

  let modalStart = source.indexOf('<Modal')
  while (modalStart !== -1) {
    const boundary = source[modalStart + '<Modal'.length]
    if (boundary === undefined || /[\s/>]/.test(boundary)) {
      const tag = openingTag(source, modalStart)
      if (!/\bonRequestClose\s*=/.test(tag)) {
        failures.push(`${relativePath}: [MODAL_SYSTEM_BACK] React Native Modal must define onRequestClose for Android system back dismissal (B-536).`)
      }
    }
    modalStart = source.indexOf('<Modal', modalStart + '<Modal'.length)
  }

  if (/\bgestureEnabled\s*(?::|=)\s*(?:\{\s*)?false\b/.test(source)) {
    failures.push(`${relativePath}: [NATIVE_BACK_GESTURE] do not disable native stack back gestures without a reviewed B-### exception.`)
  }

  if (
    /BackHandler\s*\.\s*addEventListener\s*\(\s*['"]hardwareBackPress['"]/.test(source) &&
    !allowedHardwareBackHandlers.has(relativePath)
  ) {
    failures.push(`${relativePath}: [CUSTOM_HARDWARE_BACK] custom Android back interception requires a reviewed B-### exception.`)
  }

  return failures
}

module.exports = { navigationSafetyFailures }
