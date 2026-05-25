import {
  embedTable,
  isPostTextRow,
  isRestaurantTextRow,
  parseModerateContentPayload,
  parseNotifyPayload,
  parseProcessPostMediaPayload,
  isFeatureFlagOverrideRow,
  isNotificationSettingsRow,
  postToText,
  restaurantToText,
} from '../../supabase/functions/_shared/guards'
import type { StrictAssert } from './assert'

export function runEdgeFunctionGuardTests(assert: StrictAssert) {
  assert.deepEqual(parseNotifyPayload({ type: 'like', postId: 'p1' }), { type: 'like', postId: 'p1' })
  assert.equal(parseNotifyPayload({ type: 'unknown' }), null)
  assert.equal(parseNotifyPayload(null), null)

  assert.equal(embedTable('posts'), 'posts')
  assert.equal(embedTable('users'), null)
  assert.equal(isPostTextRow({ id: 'p1' }), true)
  assert.equal(isRestaurantTextRow({ id: 'r1' }), true)
  assert.equal(isPostTextRow({ id: 1 }), false)
  assert.equal(postToText({ id: 'p1', best_dish: 'ramen', caption: null, cuisine_type: 'Japanese' }), 'ramen Japanese')
  assert.equal(restaurantToText({ id: 'r1', name: 'Cafe', suburb: 'Surry Hills' }), 'Cafe Surry Hills')

  assert.deepEqual(parseModerateContentPayload({
    messageType: 'image',
    mediaHash: 'hash',
    conversationId: 'c1',
  }), {
    messageType: 'image',
    mediaHash: 'hash',
    conversationId: 'c1',
  })
  assert.equal(parseModerateContentPayload({ messageType: 'text' }), null)
  assert.deepEqual(parseProcessPostMediaPayload({ mediaIds: ['m1', 'm2'] }), { mediaIds: ['m1', 'm2'] })
  assert.equal(parseProcessPostMediaPayload({ mediaIds: ['m1', 2] }), null)
  assert.equal(isFeatureFlagOverrideRow({ flag_name: 'search', enabled: true, expires_at: null }), true)
  assert.equal(isFeatureFlagOverrideRow({ flag_name: 'search', enabled: 'yes', expires_at: null }), false)
  assert.equal(isNotificationSettingsRow({
    notif_likes: true, notif_comments: null, notif_followers: false, notif_mentions: true, notif_messages: true,
  }), true)
}
