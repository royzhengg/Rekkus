"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMessageType = isMessageType;
exports.parseDirectMessage = parseDirectMessage;
exports.parseDirectMessageList = parseDirectMessageList;
exports.parseMessageReaction = parseMessageReaction;
exports.parsePinnedMessage = parsePinnedMessage;
exports.parseConversationParticipant = parseConversationParticipant;
const safeJson_1 = require("../../utils/safeJson");
function nullableString(value) {
    return value === null || typeof value === 'string';
}
function isMessageType(value) {
    return (value === 'text' || value === 'image' || value === 'video' || value === 'audio' ||
        value === 'gif' || value === 'sticker' || value === 'file' || value === 'location' ||
        value === 'post_share' || value === 'place_share' || value === 'system');
}
function parseDirectMessage(value) {
    if (!(0, safeJson_1.isRecord)(value) ||
        typeof value.id !== 'string' ||
        typeof value.conversation_id !== 'string' ||
        typeof value.sender_id !== 'string' ||
        !nullableString(value.body) ||
        !isMessageType(value.message_type) ||
        !nullableString(value.attachment_url) ||
        !nullableString(value.reply_to_message_id) ||
        typeof value.created_at !== 'string' ||
        !nullableString(value.deleted_at))
        return null;
    const metadata = (0, safeJson_1.isRecord)(value.attachment_metadata) ? value.attachment_metadata : null;
    return {
        id: value.id,
        conversation_id: value.conversation_id,
        sender_id: value.sender_id,
        body: value.body,
        message_type: value.message_type,
        attachment_url: value.attachment_url,
        attachment_metadata: metadata,
        reply_to_message_id: value.reply_to_message_id,
        created_at: value.created_at,
        deleted_at: value.deleted_at,
    };
}
function parseDirectMessageList(value) {
    return Array.isArray(value)
        ? value.map(parseDirectMessage).filter((message) => message !== null)
        : [];
}
function parseMessageReaction(value) {
    if (!(0, safeJson_1.isRecord)(value) ||
        typeof value.id !== 'string' ||
        typeof value.message_id !== 'string' ||
        typeof value.user_id !== 'string' ||
        typeof value.emoji !== 'string' ||
        typeof value.created_at !== 'string')
        return null;
    return {
        id: value.id,
        message_id: value.message_id,
        user_id: value.user_id,
        emoji: value.emoji,
        created_at: value.created_at,
    };
}
function parsePinnedMessage(value) {
    if (!(0, safeJson_1.isRecord)(value) ||
        typeof value.id !== 'string' ||
        typeof value.conversation_id !== 'string' ||
        typeof value.message_id !== 'string' ||
        !nullableString(value.pinned_by) ||
        typeof value.pinned_at !== 'string')
        return null;
    return {
        id: value.id,
        conversation_id: value.conversation_id,
        message_id: value.message_id,
        pinned_by: value.pinned_by,
        pinned_at: value.pinned_at,
    };
}
function parseConversationParticipant(value) {
    if (!(0, safeJson_1.isRecord)(value) || typeof value.user_id !== 'string')
        return null;
    const users = (0, safeJson_1.isRecord)(value.users) ? value.users : null;
    if (!users || typeof users.username !== 'string')
        return null;
    return {
        user_id: value.user_id,
        username: users.username,
        full_name: nullableString(users.full_name) ? users.full_name : null,
        avatar_url: nullableString(users.avatar_url) ? users.avatar_url : null,
        is_admin: typeof value.is_admin === 'boolean' ? value.is_admin : false,
        last_seen_at: nullableString(users.last_seen_at) ? users.last_seen_at : null,
    };
}
