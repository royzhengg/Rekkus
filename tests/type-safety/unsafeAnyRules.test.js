const test = require('node:test')
const assert = require('node:assert/strict')
const { unsafeAnyFailures } = require('../../scripts/lib/unsafe-any-rules')

function codes(source) {
  return unsafeAnyFailures('fixture.ts', source).map(line => line.match(/\[(.*?)\]/)?.[1])
}

test('unsafe-any scanner catches explicit unsafe patterns', () => {
  assert.deepEqual(codes('const value: any = input'), ['UNSAFE_ANY'])
  assert.deepEqual(codes('const value = input as any'), ['UNSAFE_ANY'])
  assert.deepEqual(codes('// @ts-ignore\nconst value = 1'), ['TS_IGNORE'])
  assert.deepEqual(codes('@ts-ignore'), ['TS_IGNORE'])
  assert.deepEqual(codes('// @ts-nocheck'), ['TS_NOCHECK'])
  assert.deepEqual(codes('// @ts-expect-error'), ['TS_EXPECT_ERROR'])
  assert.deepEqual(codes('const value = JSON.parse(raw) as string[]'), ['UNSAFE_JSON_PARSE'])
  assert.deepEqual(codes('const client = supabase as Something'), ['UNSAFE_SUPABASE_CAST'])
  assert.deepEqual(codes('/* eslint-disable no-alert */'), ['ESLINT_DISABLE'])
})

test('unsafe-any scanner allows explained expected TypeScript failures only', () => {
  assert.deepEqual(unsafeAnyFailures('fixture.ts', '// @ts-expect-error -- upstream package definition is incomplete'), [])
})
