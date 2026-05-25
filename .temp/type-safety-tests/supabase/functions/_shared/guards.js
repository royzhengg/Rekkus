"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.parseNotifyPayload = parseNotifyPayload;
exports.embedTable = embedTable;
exports.isPostTextRow = isPostTextRow;
exports.isRestaurantTextRow = isRestaurantTextRow;
exports.postToText = postToText;
exports.restaurantToText = restaurantToText;
exports.parseModerateContentPayload = parseModerateContentPayload;
exports.parseProcessPostMediaPayload = parseProcessPostMediaPayload;
exports.isFeatureFlagOverrideRow = isFeatureFlagOverrideRow;
exports.isNotificationActorRow = isNotificationActorRow;
exports.isNotificationUserIdRow = isNotificationUserIdRow;
exports.isPushTokenRow = isPushTokenRow;
exports.isNotificationSettingsRow = isNotificationSettingsRow;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseNotifyPayload(value) {
    if (!isRecord(value))
        return null;
    const type = value.type;
    if (type !== 'like' &&
        type !== 'comment' &&
        type !== 'follow' &&
        type !== 'comment_reply' &&
        type !== 'message')
        return null;
    const payload = { type };
    if (typeof value.postId === 'string')
        payload.postId = value.postId;
    if (typeof value.followedId === 'string')
        payload.followedId = value.followedId;
    if (typeof value.commentId === 'string')
        payload.commentId = value.commentId;
    if (typeof value.conversationId === 'string')
        payload.conversationId = value.conversationId;
    if (typeof value.messageId === 'string')
        payload.messageId = value.messageId;
    return payload;
}
function embedTable(value) {
    return value === 'posts' || value === 'restaurants' ? value : null;
}
function isPostTextRow(value) {
    return isRecord(value) && typeof value.id === 'string';
}
function isRestaurantTextRow(value) {
    return isRecord(value) && typeof value.id === 'string';
}
function postToText(post) {
    return [post.best_dish, post.caption, post.cuisine_type]
        .filter(Boolean)
        .join(' ')
        .trim();
}
function restaurantToText(r) {
    return [r.name, r.cuisine_type, r.suburb, r.city]
        .filter(Boolean)
        .join(' ')
        .trim();
}
function parseModerateContentPayload(value) {
    if (!isRecord(value))
        return null;
    if (typeof value.messageType !== 'string')
        return null;
    if (typeof value.conversationId !== 'string' || value.conversationId.length === 0)
        return null;
    const payload = {
        messageType: value.messageType,
        conversationId: value.conversationId,
    };
    if (typeof value.body === 'string')
        payload.body = value.body;
    if (typeof value.mediaHash === 'string')
        payload.mediaHash = value.mediaHash;
    return payload;
}
function parseProcessPostMediaPayload(value) {
    if (!isRecord(value) || !Array.isArray(value.mediaIds))
        return null;
    const mediaIds = value.mediaIds.filter((id) => typeof id === 'string' && id.length > 0);
    return mediaIds.length === value.mediaIds.length ? { mediaIds } : null;
}
function isFeatureFlagOverrideRow(value) {
    return (isRecord(value) &&
        typeof value.flag_name === 'string' &&
        typeof value.enabled === 'boolean' &&
        (value.expires_at === null || typeof value.expires_at === 'string'));
}
function isNotificationActorRow(value) {
    return isRecord(value) && typeof value.username === 'string' && (value.full_name === null || typeof value.full_name === 'string');
}
function isNotificationUserIdRow(value) {
    return isRecord(value) && (value.user_id === null || typeof value.user_id === 'string');
}
function isPushTokenRow(value) {
    return isRecord(value) && typeof value.token === 'string' && value.token.length > 0;
}
function isNotificationSettingsRow(value) {
    if (!isRecord(value))
        return false;
    return ['notif_likes', 'notif_comments', 'notif_followers', 'notif_mentions', 'notif_messages']
        .every(key => value[key] === null || typeof value[key] === 'boolean');
}
