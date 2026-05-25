const assert = require('node:assert/strict')
const test = require('node:test')
const { runtimeBoundaryFailures } = require('../../scripts/lib/runtime-boundary-rules')

test('runtime boundary scanner rejects asserted untrusted input', () => {
  assert.equal(runtimeBoundaryFailures('cache.ts', 'readOfflineCache<Post[]>(key)').length, 1)
  assert.equal(runtimeBoundaryFailures('events.ts', 'const message = payload.new as DirectMessage').length, 1)
  assert.equal(runtimeBoundaryFailures('edge.ts', 'const payload = (await req.json()) as Payload').length, 1)
  assert.equal(runtimeBoundaryFailures('provider.ts', 'googleResultEnvelope<Item>(json)').length, 1)
})

test('runtime boundary scanner permits guarded reads', () => {
  const guarded = [
    'readOfflineCache(key, isPostList)',
    'const message = parseDirectMessage(payload.new)',
    'const payload = parsePayload(await req.json())',
    'googleResultEnvelope(json, isItem)',
  ].join('\n')
  assert.deepEqual(runtimeBoundaryFailures('safe.ts', guarded), [])
})
