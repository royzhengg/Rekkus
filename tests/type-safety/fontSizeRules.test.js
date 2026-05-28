const test = require('node:test')
const assert = require('node:assert/strict')
const { fontSizeFailures } = require('../../scripts/lib/font-size-rules')

function codes(relativePath, source) {
  return fontSizeFailures(relativePath, source).map(l => l.match(/\[(.*?)\]/)?.[1])
}

test('rejects fontSize literals below 12 in features and components', () => {
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: 10'), ['MIN_FONT_SIZE'])
  assert.deepEqual(codes('components/Tag.tsx', 'fontSize: 8'), ['MIN_FONT_SIZE'])
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: 11.5'), ['MIN_FONT_SIZE'])
  assert.deepEqual(codes('app/index.tsx', 'fontSize: 6'), ['MIN_FONT_SIZE'])
  assert.deepEqual(codes('lib/contexts/ThemeContext.tsx', 'fontSize: 11'), ['MIN_FONT_SIZE'])
})

test('rejects sub-minimum even when check:tokens-ignore is present', () => {
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: 10 // check:tokens-ignore'), ['MIN_FONT_SIZE'])
})

test('accepts fontSize at or above minimum', () => {
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: 12'), [])
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: 14'), [])
  assert.deepEqual(codes('components/Tag.tsx', 'fontSize: 24'), [])
})

test('ignores token references (not a bare numeric literal)', () => {
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: fontSize.xs'), [])
  assert.deepEqual(codes('features/Feed/Screen.tsx', 'fontSize: typography.caption.fontSize'), [])
})

test('ignores files outside scanned directories', () => {
  assert.deepEqual(codes('lib/config.ts', 'fontSize: 10'), [])
  assert.deepEqual(codes('scripts/check-tokens.js', 'fontSize: 8'), [])
  assert.deepEqual(codes('constants/Typography.ts', 'fontSize: 6.5'), [])
})
