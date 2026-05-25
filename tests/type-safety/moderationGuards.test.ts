import { isModerationResponse } from '../../lib/services/moderationGuards'
import type { StrictAssert } from './assert'

export function runModerationGuardTests(assert: StrictAssert) {
  assert.equal(isModerationResponse({ safe: true }), true)
  assert.equal(isModerationResponse({ safe: false, reason: 'blocked' }), true)
  assert.equal(isModerationResponse({ safe: 'yes' }), false)
  assert.equal(isModerationResponse(null), false)
}
