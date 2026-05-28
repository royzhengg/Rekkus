const test = require('node:test')
const assert = require('node:assert/strict')
const { motionFailures } = require('../../scripts/lib/motion-rules')

function codes(relativePath, source) {
  return motionFailures(relativePath, source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('motion scanner rejects unowned motion, playback and haptics', () => {
  assert.deepEqual(codes('features/example/Screen.tsx', "import Animated, { withSpring } from 'react-native-reanimated'\nvalue.value = withSpring(1)"), ['REDUCED_MOTION'])
  assert.deepEqual(codes('components/example.tsx', "import { Animated } from 'react-native'\n"), ['RN_ANIMATED'])
  assert.deepEqual(codes('features/example/Screen.tsx', "import * as Haptics from 'expo-haptics'\n"), ['DIRECT_HAPTICS'])
  assert.deepEqual(codes('features/example/Screen.tsx', 'void haptic.light()'), ['GENERIC_HAPTIC'])
  assert.deepEqual(codes('components/post/OtherPlayer.tsx', 'const player = useVideoPlayer(uri)'), ['VIDEO_PLAYBACK_OWNER'])
  assert.deepEqual(codes('components/post/OtherPlayer.tsx', 'player.play()'), ['VIDEO_AUTOPLAY_OWNER'])
  assert.deepEqual(codes('components/example.tsx', '<Modal animationType="slide" />'), ['REDUCED_MODAL_MOTION'])
})

test('motion scanner permits canonical ownership and reduced-motion branches', () => {
  assert.deepEqual(
    codes('features/example/Screen.tsx', 'const reduceMotion = useReducedMotion()\nvalue.value = reduceMotion ? 0 : withSpring(1)'),
    [],
  )
  assert.deepEqual(codes('lib/haptics.ts', "import * as Haptics from 'expo-haptics'\n"), [])
  assert.deepEqual(codes('lib/hooks/usePostVideoPlayback.ts', 'const player = useVideoPlayer(uri)\nplayer.play()'), [])
  assert.deepEqual(codes('components/example.tsx', "const reduceMotion = useReducedMotion()\n<Modal animationType={reduceMotion ? 'none' : 'slide'} />"), [])
})
