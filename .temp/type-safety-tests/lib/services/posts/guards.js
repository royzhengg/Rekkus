"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPostMediaStatus = isPostMediaStatus;
exports.isTasteVerdict = isTasteVerdict;
exports.isValueVerdict = isValueVerdict;
exports.isOccasionTag = isOccasionTag;
exports.isRawPost = isRawPost;
exports.isCachedPost = isCachedPost;
exports.isCachedPostList = isCachedPostList;
const safeJson_1 = require("../../utils/safeJson");
function isNullableString(value) {
    return value === null || typeof value === 'string';
}
function isNullableNumber(value) {
    return value === null || typeof value === 'number';
}
function isPostMediaStatus(value) {
    return (value === 'local_ready' || value === 'queued' || value === 'preparing' || value === 'ready' ||
        value === 'failed' || value === 'uploading' || value === 'uploaded' || value === 'processing');
}
function isTasteVerdict(value) {
    return value === 'not_for_me' || value === 'good' || value === 'craveable' || value === 'must_order' || value === 'worth_a_trip';
}
function isValueVerdict(value) {
    return value === 'not_worth_it' || value === 'fair' || value === 'great_value' || value === 'worth_the_splurge';
}
function isOccasionTag(value) {
    return value === 'quick_bite' || value === 'solo' || value === 'casual' || value === 'date_night' || value === 'group' || value === 'special';
}
function isRawPostPhoto(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'string' &&
        typeof value.url === 'string' &&
        isNullableString(value.deleted_at) &&
        (value.media_type === null || value.media_type === 'image' || value.media_type === 'video') &&
        isNullableString(value.processed_url) &&
        isNullableString(value.thumbnail_url) &&
        isNullableString(value.mime_type) &&
        isNullableNumber(value.duration_ms) &&
        isNullableNumber(value.width) &&
        isNullableNumber(value.height) &&
        isNullableNumber(value.size_bytes) &&
        (value.processing_status === null || isPostMediaStatus(value.processing_status)) &&
        isNullableString(value.processing_error) &&
        isNullableNumber(value.order_index));
}
function isUserRelation(value) {
    return value === null || ((0, safeJson_1.isRecord)(value) &&
        typeof value.username === 'string' &&
        isNullableString(value.full_name) &&
        isNullableString(value.avatar_url));
}
function isRestaurantRelation(value) {
    return value === null || ((0, safeJson_1.isRecord)(value) &&
        typeof value.name === 'string' &&
        isNullableString(value.address) &&
        isNullableNumber(value.latitude) &&
        isNullableNumber(value.longitude) &&
        isNullableString(value.google_place_id));
}
function isRawPost(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'string' &&
        typeof value.user_id === 'string' &&
        isNullableString(value.caption) &&
        isNullableNumber(value.food_rating) &&
        isNullableNumber(value.vibe_rating) &&
        isNullableNumber(value.cost_rating) &&
        isNullableString(value.cuisine_type) &&
        isNullableString(value.best_dish) &&
        isNullableString(value.restaurant_id) &&
        (value.taste_verdict === null || isTasteVerdict(value.taste_verdict)) &&
        (value.value_verdict === null || isValueVerdict(value.value_verdict)) &&
        (value.occasion_tags === null || (Array.isArray(value.occasion_tags) && value.occasion_tags.every(isOccasionTag))) &&
        isNullableString(value.created_at) &&
        isNullableString(value.last_edited_at) &&
        isNullableNumber(value.edit_count) &&
        isUserRelation(value.users) &&
        (value.post_photos === null || (Array.isArray(value.post_photos) && value.post_photos.every(isRawPostPhoto))) &&
        isRestaurantRelation(value.restaurants));
}
function isPostMediaAsset(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.localId === 'string' &&
        typeof value.uri === 'string' &&
        (value.type === 'image' || value.type === 'video') &&
        (value.processingStatus === undefined || isPostMediaStatus(value.processingStatus)));
}
function isCachedPost(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'number' &&
        typeof value.dbId === 'string' &&
        typeof value.title === 'string' &&
        typeof value.body === 'string' &&
        typeof value.creator === 'string' &&
        typeof value.initials === 'string' &&
        typeof value.avatarBg === 'string' &&
        typeof value.avatarColor === 'string' &&
        typeof value.likes === 'string' &&
        typeof value.imgKey === 'string' &&
        typeof value.tall === 'boolean' &&
        Array.isArray(value.tags) &&
        typeof value.location === 'string' &&
        typeof value.food === 'number' &&
        typeof value.vibe === 'number' &&
        typeof value.cost === 'number' &&
        (value.media === undefined || (Array.isArray(value.media) && value.media.every(isPostMediaAsset))));
}
function isCachedPostList(value) {
    return Array.isArray(value) && value.every(isCachedPost);
}
