import { isRecord, isStringArray, parseJsonWithGuard } from '../../lib/utils/safeJson'
import type { StrictAssert } from './assert'

export function runSafeJsonTests(assert: StrictAssert) {
  assert.deepEqual(parseJsonWithGuard('["a","b"]', isStringArray), ['a', 'b'])
  assert.equal(parseJsonWithGuard('["a",1]', isStringArray), null)
  assert.equal(parseJsonWithGuard('{bad json', isRecord), null)
  assert.deepEqual(parseJsonWithGuard('{"ok":true}', isRecord), { ok: true })
}
