const assert = require('node:assert/strict')
const test = require('node:test')
const { iosVisualFailures } = require('../../scripts/lib/ios-visual-rules')

function codes(relativePath, source) {
  return iosVisualFailures(relativePath, source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('iOS visual scanner rejects unstable native visual adoption', () => {
  assert.deepEqual(
    codes(
      'app/(tabs)/_layout.tsx',
      "import { NativeTabs } from 'expo-router/unstable-native-tabs'"
    ),
    [
      'UNSTABLE_IOS_VISUAL_API',
      'IOS_TAB_MATERIAL_GATE',
      'IOS_TAB_MATERIAL_GATE',
      'IOS_TAB_MATERIAL_GATE',
      'IOS_TAB_MATERIAL_GATE',
      'IOS_TAB_MATERIAL_GATE',
      'IOS_TAB_MATERIAL_GATE',
    ]
  )
  assert.deepEqual(
    codes('components/ui/Glass.tsx', "import { GlassView } from 'expo-glass-effect'"),
    ['UNSTABLE_IOS_VISUAL_API']
  )
})

test('iOS visual scanner requires a material fallback and staging-only gate', () => {
  assert.ok(
    codes(
      'components/ui/TabBarMaterialBackground.tsx',
      "import { BlurView } from 'expo-blur'"
    ).includes('IOS_TAB_OPAQUE_FALLBACK')
  )
  assert.ok(
    codes('lib/utils/iosTabMaterial.ts', "return environment === 'production'").includes(
      'IOS_TAB_ENV_GATE'
    )
  )
})

test('iOS visual scanner permits the canonical markers', () => {
  assert.deepEqual(
    codes(
      'components/ui/TabBarMaterialBackground.tsx',
      "import { BlurView } from 'expo-blur'\nuseReduceTransparency()\nPlatform.OS === 'ios'\nconst testID = 'tab-bar-opaque-background'"
    ),
    []
  )
  assert.deepEqual(
    codes(
      'lib/utils/iosTabMaterial.ts',
      "return platform === 'ios' && (environment === 'development' || environment === 'staging')"
    ),
    []
  )
})
