"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocalDraft = isLocalDraft;
exports.isLocalDraftList = isLocalDraftList;
exports.isRemoteDraftRow = isRemoteDraftRow;
exports.isRemoteDraftSummaryRow = isRemoteDraftSummaryRow;
exports.isRemoteDraftTitleRow = isRemoteDraftTitleRow;
const safeJson_1 = require("../../utils/safeJson");
function nullableString(value) {
    return value === null || typeof value === 'string';
}
function nullableNumber(value) {
    return value === null || typeof value === 'number';
}
function isDraftStatus(value) {
    return value === 'autosave' || value === 'saved' || value === 'discarded' || value === 'published';
}
function isSyncStatus(value) {
    return value === 'local' || value === 'syncing' || value === 'synced' || value === 'failed';
}
function isTaste(value) {
    return value === 'not_for_me' || value === 'good' || value === 'craveable' || value === 'must_order' || value === 'worth_a_trip';
}
function isValue(value) {
    return value === 'not_worth_it' || value === 'fair' || value === 'great_value' || value === 'worth_the_splurge';
}
function isOccasion(value) {
    return value === 'quick_bite' || value === 'solo' || value === 'casual' || value === 'date_night' || value === 'group' || value === 'special';
}
function isDishTag(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.photoIndex === 'number' &&
        typeof value.x === 'number' &&
        typeof value.y === 'number' &&
        typeof value.name === 'string');
}
function isSelectedPlace(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.placeId === 'string' &&
        typeof value.name === 'string' &&
        typeof value.address === 'string' &&
        typeof value.lat === 'number' &&
        typeof value.lng === 'number');
}
function isMedia(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.localId === 'string' &&
        typeof value.uri === 'string' &&
        (value.type === 'image' || value.type === 'video'));
}
function isLocalDraft(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        Array.isArray(value.media) && value.media.every(isMedia) &&
        typeof value.title === 'string' &&
        (value.selectedPlace === null || isSelectedPlace(value.selectedPlace)) &&
        Array.isArray(value.dishTags) && value.dishTags.every(isDishTag) &&
        typeof value.foodRating === 'number' &&
        typeof value.vibeRating === 'number' &&
        typeof value.costRating === 'number' &&
        typeof value.body === 'string' &&
        typeof value.bestDish === 'string' &&
        typeof value.cuisineType === 'string' &&
        Array.isArray(value.hashtags) && value.hashtags.every(tag => typeof tag === 'string') &&
        typeof value.hashtagInput === 'string' &&
        typeof value.updatedAt === 'string' &&
        (value.status === undefined || isDraftStatus(value.status)) &&
        (value.syncStatus === undefined || isSyncStatus(value.syncStatus)) &&
        (value.tasteVerdict === undefined || isTaste(value.tasteVerdict)) &&
        (value.valueVerdict === undefined || isValue(value.valueVerdict)) &&
        (value.occasionTags === undefined || (Array.isArray(value.occasionTags) && value.occasionTags.every(isOccasion))));
}
function isLocalDraftList(value) {
    return Array.isArray(value) && value.every(isLocalDraft);
}
function isRemoteMedia(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.local_id === 'string' &&
        (value.media_type === 'image' || value.media_type === 'video') &&
        nullableString(value.storage_path) &&
        nullableString(value.thumbnail_url) &&
        nullableString(value.public_preview_url) &&
        nullableString(value.mime_type) &&
        nullableNumber(value.size_bytes) &&
        nullableNumber(value.duration_ms) &&
        nullableNumber(value.width) &&
        nullableNumber(value.height) &&
        nullableString(value.processing_status) &&
        nullableString(value.processing_error) &&
        nullableNumber(value.order_index) &&
        (value.is_cover === null || typeof value.is_cover === 'boolean'));
}
function isRemoteDraftRow(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'string' &&
        typeof value.user_id === 'string' &&
        isDraftStatus(value.status) &&
        nullableString(value.title) &&
        nullableString(value.body) &&
        (value.selected_place === null || isSelectedPlace(value.selected_place)) &&
        (value.dish_tags === null || (Array.isArray(value.dish_tags) && value.dish_tags.every(isDishTag))) &&
        nullableNumber(value.food_rating) &&
        nullableNumber(value.vibe_rating) &&
        nullableNumber(value.cost_rating) &&
        (value.taste_verdict === null || isTaste(value.taste_verdict)) &&
        (value.value_verdict === null || isValue(value.value_verdict)) &&
        (value.occasion_tags === null || (Array.isArray(value.occasion_tags) && value.occasion_tags.every(isOccasion))) &&
        nullableString(value.best_dish) &&
        nullableString(value.cuisine_type) &&
        (value.hashtags === null || (Array.isArray(value.hashtags) && value.hashtags.every(tag => typeof tag === 'string'))) &&
        nullableString(value.hashtag_input) &&
        typeof value.created_at === 'string' &&
        typeof value.updated_at === 'string' &&
        nullableString(value.last_saved_at) &&
        (value.post_draft_media === undefined || value.post_draft_media === null || (Array.isArray(value.post_draft_media) && value.post_draft_media.every(isRemoteMedia))));
}
function isRemoteDraftSummaryRow(value) {
    if (!(0, safeJson_1.isRecord)(value) ||
        typeof value.id !== 'string' ||
        !nullableString(value.title) ||
        !nullableString(value.body) ||
        (value.selected_place !== null && !isSelectedPlace(value.selected_place)) ||
        typeof value.updated_at !== 'string' ||
        !nullableString(value.last_saved_at) ||
        !Array.isArray(value.post_draft_media))
        return false;
    return value.post_draft_media.every(media => (0, safeJson_1.isRecord)(media) &&
        nullableString(media.storage_path) &&
        nullableString(media.thumbnail_url) &&
        nullableNumber(media.order_index));
}
function isRemoteDraftTitleRow(value) {
    return (0, safeJson_1.isRecord)(value) && nullableString(value.title) && nullableString(value.body);
}
