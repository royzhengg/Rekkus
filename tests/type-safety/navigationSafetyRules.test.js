const test = require('node:test')
const assert = require('node:assert/strict')
const { navigationSafetyFailures } = require('../../scripts/lib/navigation-safety-rules')

function codes(relativePath, source) {
  return navigationSafetyFailures(relativePath, source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('navigation safety scanner rejects modals without system-back dismissal', () => {
  assert.deepEqual(
    codes('features/example/Screen.tsx', '<Modal visible={open}><View /></Modal>'),
    ['MODAL_SYSTEM_BACK'],
  )
})

test('navigation safety scanner accepts inline and multiline modal dismissal handlers', () => {
  assert.deepEqual(
    codes('features/example/Screen.tsx', '<Modal visible={open} onRequestClose={onClose}><View /></Modal>'),
    [],
  )
  assert.deepEqual(
    codes(
      'components/example/Overlay.tsx',
      `<Modal
        visible={open}
        onRequestClose={() => {
          setOpen(false)
        }}
      >
        <View />
      </Modal>`,
    ),
    [],
  )
})

test('navigation safety scanner rejects disabled native gestures and unapproved hardware-back interception', () => {
  assert.deepEqual(
    codes('features/example/Screen.tsx', '<Stack.Screen options={{ gestureEnabled: false }} />'),
    ['NATIVE_BACK_GESTURE'],
  )
  assert.deepEqual(
    codes('components/example/Overlay.tsx', "BackHandler.addEventListener('hardwareBackPress', onBack)"),
    ['CUSTOM_HARDWARE_BACK'],
  )
})

test('navigation safety scanner permits the intentional create-post stepped back handler', () => {
  assert.deepEqual(
    codes(
      'features/create-post/CreatePostScreen.tsx',
      "usePreventRemove(shouldProtectNativeDismiss, () => { pendingRemoveAction.current = null }); BackHandler.addEventListener('hardwareBackPress', () => { handleBackRef.current(); return true })",
    ),
    [],
  )
})

test('navigation safety scanner enforces create-post modal ownership', () => {
  assert.deepEqual(
    codes('lib/routes/index.ts', "createPost: () => ({ pathname: '/(tabs)/create' })"),
    ['CREATE_POST_TAB_ROUTE'],
  )
  assert.deepEqual(
    codes('app/(tabs)/_layout.tsx', '<Tabs.Screen name="create" options={{ href: null }} />'),
    ['CREATE_POST_TAB_SCREEN'],
  )
  assert.deepEqual(
    codes('features/create-post/CreatePostScreen.tsx', 'export default function PostScreen() { return null }'),
    ['CREATE_POST_DISMISS_GUARD'],
  )
  assert.deepEqual(
    codes(
      'features/create-post/CreatePostScreen.tsx',
      'usePreventRemove(shouldProtectNativeDismiss, () => { pendingRemoveAction.current = null })',
    ),
    [],
  )
})
