const test = require('node:test')
const assert = require('node:assert/strict')
const { loadingSurfaceFailures } = require('../../scripts/lib/loading-surface-rules')

function codes(source) {
  return loadingSurfaceFailures('features/example/Screen.tsx', source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('loading scanner rejects centred content-level spinners including inline styles', () => {
  assert.deepEqual(codes('<View style={styles.center}><ActivityIndicator /></View>'), ['CENTRED_CONTENT_SPINNER'])
  assert.deepEqual(
    codes("<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>"),
    ['CENTRED_CONTENT_SPINNER'],
  )
  assert.deepEqual(
    codes("<View style={{ justifyContent: 'center', flex: 1, alignItems: 'center' }}><ActivityIndicator /></View>"),
    ['CENTRED_CONTENT_SPINNER'],
  )
})

test('loading scanner allows canonical contextual loading surfaces', () => {
  assert.deepEqual(codes('<TouchableOpacity><ActivityIndicator /></TouchableOpacity>'), [])
  assert.deepEqual(codes('<View style={styles.loadingFooter}><ActivityIndicator /></View>'), [])
  assert.deepEqual(codes('<View><Skeleton /><SkeletonText /></View>'), [])
  assert.deepEqual(codes('<EmptyState loading title="Opening" />'), [])
})
