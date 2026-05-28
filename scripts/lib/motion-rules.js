function motionFailures(relativePath, source) {
  const failures = []
  const runtimeFile = /^(?:app|components|features|lib)\//.test(relativePath)
  if (!runtimeFile || !/\.[jt]sx?$/.test(relativePath)) return failures

  if (
    relativePath !== 'lib/haptics.ts' &&
    /from ['"]expo-haptics['"]|require\(['"]expo-haptics['"]\)/.test(source)
  ) {
    failures.push(`${relativePath}: [DIRECT_HAPTICS] use semantic feedback methods from @/lib/haptics.`)
  }

  if (
    relativePath !== 'lib/hooks/usePostVideoPlayback.ts' &&
    /\buseVideoPlayer\s*\(/.test(source)
  ) {
    failures.push(`${relativePath}: [VIDEO_PLAYBACK_OWNER] own post video playback through usePostVideoPlayback.`)
  }

  if (
    relativePath !== 'lib/hooks/usePostVideoPlayback.ts' &&
    /\bplayer\.play\s*\(/.test(source)
  ) {
    failures.push(`${relativePath}: [VIDEO_AUTOPLAY_OWNER] trigger post video playback through usePostVideoPlayback.`)
  }

  if (/import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from ['"]react-native['"]/.test(source)) {
    failures.push(`${relativePath}: [RN_ANIMATED] use react-native-reanimated for animated interactions.`)
  }

  if (/\bhaptic\.(?:light|medium|success)\s*\(/.test(source)) {
    failures.push(`${relativePath}: [GENERIC_HAPTIC] use approved semantic haptic feedback methods.`)
  }

  const automaticMotion = /\b(?:withSpring|withTiming|withRepeat|withSequence|animateToRegion)\s*\(|\bentering=|\bexiting=/.test(source)
  const ownedMotionModule = relativePath === 'lib/animations.ts' || relativePath === 'lib/hooks/usePressScale.ts'
  if (automaticMotion && !ownedMotionModule && !/\buseReducedMotion\b/.test(source)) {
    failures.push(`${relativePath}: [REDUCED_MOTION] automatic motion must consult useReducedMotion().`)
  }

  if (/animationType=\{?['"](?:slide|fade)['"]\}?/.test(source) && !/\buseReducedMotion\b/.test(source)) {
    failures.push(`${relativePath}: [REDUCED_MODAL_MOTION] native modal transitions must consult useReducedMotion().`)
  }

  return failures
}

module.exports = { motionFailures }
