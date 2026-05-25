"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEdgeFunctionGuardTests = runEdgeFunctionGuardTests;
const guards_1 = require("../../supabase/functions/_shared/guards");
function runEdgeFunctionGuardTests(assert) {
    assert.deepEqual((0, guards_1.parseNotifyPayload)({ type: 'like', postId: 'p1' }), { type: 'like', postId: 'p1' });
    assert.equal((0, guards_1.parseNotifyPayload)({ type: 'unknown' }), null);
    assert.equal((0, guards_1.parseNotifyPayload)(null), null);
    assert.equal((0, guards_1.embedTable)('posts'), 'posts');
    assert.equal((0, guards_1.embedTable)('users'), null);
    assert.equal((0, guards_1.isPostTextRow)({ id: 'p1' }), true);
    assert.equal((0, guards_1.isRestaurantTextRow)({ id: 'r1' }), true);
    assert.equal((0, guards_1.isPostTextRow)({ id: 1 }), false);
    assert.equal((0, guards_1.postToText)({ id: 'p1', best_dish: 'ramen', caption: null, cuisine_type: 'Japanese' }), 'ramen Japanese');
    assert.equal((0, guards_1.restaurantToText)({ id: 'r1', name: 'Cafe', suburb: 'Surry Hills' }), 'Cafe Surry Hills');
    assert.deepEqual((0, guards_1.parseModerateContentPayload)({
        messageType: 'image',
        mediaHash: 'hash',
        conversationId: 'c1',
    }), {
        messageType: 'image',
        mediaHash: 'hash',
        conversationId: 'c1',
    });
    assert.equal((0, guards_1.parseModerateContentPayload)({ messageType: 'text' }), null);
    assert.deepEqual((0, guards_1.parseProcessPostMediaPayload)({ mediaIds: ['m1', 'm2'] }), { mediaIds: ['m1', 'm2'] });
    assert.equal((0, guards_1.parseProcessPostMediaPayload)({ mediaIds: ['m1', 2] }), null);
    assert.equal((0, guards_1.isFeatureFlagOverrideRow)({ flag_name: 'search', enabled: true, expires_at: null }), true);
    assert.equal((0, guards_1.isFeatureFlagOverrideRow)({ flag_name: 'search', enabled: 'yes', expires_at: null }), false);
    assert.equal((0, guards_1.isNotificationSettingsRow)({
        notif_likes: true, notif_comments: null, notif_followers: false, notif_mentions: true, notif_messages: true,
    }), true);
}
