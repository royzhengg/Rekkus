function iosVisualFailures(relativePath, source) {
  const failures = []
  const runtimeFile = /^(?:app|components|features|lib)\//.test(relativePath)
  if (!runtimeFile || !/\.[jt]sx?$/.test(relativePath)) return failures

  if (/expo-router\/unstable-native-tabs|expo-glass-effect/.test(source)) {
    failures.push(
      `${relativePath}: [UNSTABLE_IOS_VISUAL_API] B-531 permits existing-tab expo-blur evaluation only.`
    )
  }

  if (relativePath === 'app/(tabs)/_layout.tsx') {
    for (const required of [
      "useFeatureFlag('iosTabBarMaterial')",
      'canUseIosTabBarMaterial',
      'TabBarMaterialBackground',
      'tabBarBackground',
      'sceneStyle',
      'FloatingActionButton',
    ]) {
      if (!source.includes(required)) {
        failures.push(
          `${relativePath}: [IOS_TAB_MATERIAL_GATE] missing required gated tab token "${required}".`
        )
      }
    }
  }

  if (relativePath === 'components/ui/TabBarMaterialBackground.tsx') {
    for (const required of [
      "from 'expo-blur'",
      'useReduceTransparency',
      "Platform.OS === 'ios'",
      'tab-bar-opaque-background',
    ]) {
      if (!source.includes(required)) {
        failures.push(
          `${relativePath}: [IOS_TAB_OPAQUE_FALLBACK] missing required fallback token "${required}".`
        )
      }
    }
  }

  if (relativePath === 'lib/utils/iosTabMaterial.ts') {
    for (const required of [
      "platform === 'ios'",
      "environment === 'development'",
      "environment === 'staging'",
    ]) {
      if (!source.includes(required)) {
        failures.push(
          `${relativePath}: [IOS_TAB_ENV_GATE] missing required environment token "${required}".`
        )
      }
    }
    if (/environment\s*===\s*['"](?:beta|production)['"]/.test(source)) {
      failures.push(
        `${relativePath}: [IOS_TAB_ENV_GATE] beta and production must not opt into B-531 material.`
      )
    }
  }

  return failures
}

module.exports = { iosVisualFailures }
