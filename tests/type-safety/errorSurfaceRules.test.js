const test = require('node:test')
const assert = require('node:assert/strict')
const { errorSurfaceFailures } = require('../../scripts/lib/error-surface-rules')

function codes(source) {
  return errorSurfaceFailures('features/example/Screen.tsx', source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('error-surface scanner rejects retired error display patterns', () => {
  assert.deepEqual(codes('<Text style={styles.errorText}>{error}</Text>'), ['CUSTOM_ERROR_SURFACE', 'INLINE_ERROR_TEXT'])
  assert.deepEqual(codes("Alert.alert('Could not save', 'Try again.')"), ['FAILURE_ALERT'])
  assert.deepEqual(codes("setNotice({ title: 'Upload failed', subtitle: 'Try again.' })"), ['FAILURE_NOTICE'])
})

test('error-surface scanner permits canonical and intentional interaction patterns', () => {
  assert.deepEqual(codes('<ErrorMessage title="Could not save" message={error} />'), [])
  assert.deepEqual(codes('<Text style={styles.matchError}>Passwords do not match</Text>'), [])
  assert.deepEqual(codes("Alert.alert('Permission required', 'Enable camera access.')"), [])
  assert.deepEqual(codes("setNotice({ title: 'Report received', subtitle: 'Thanks.' })"), [])
  assert.deepEqual(codes("setDraftNotice({ title: 'Could not publish post', subtitle: 'Try again.' })"), [])
})
