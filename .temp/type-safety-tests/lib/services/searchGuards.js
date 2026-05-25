"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlaceResult = isPlaceResult;
exports.parsePlaceResults = parsePlaceResults;
exports.isSearchSuggestion = isSearchSuggestion;
exports.parseSearchSuggestions = parseSearchSuggestions;
exports.parseRankedPostIds = parseRankedPostIds;
exports.parseDishPostIds = parseDishPostIds;
const safeJson_1 = require("../utils/safeJson");
function nullableString(value) {
    return value === null || typeof value === 'string';
}
function nullableNumber(value) {
    return value === null || typeof value === 'number';
}
function isPlaceResult(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        nullableString(value.address) &&
        nullableString(value.city) &&
        nullableString(value.cuisine_type) &&
        nullableString(value.google_place_id) &&
        nullableNumber(value.latitude) &&
        nullableNumber(value.longitude) &&
        nullableNumber(value.google_rating) &&
        nullableNumber(value.google_review_count));
}
function parsePlaceResults(value) {
    return Array.isArray(value) ? value.filter(isPlaceResult) : [];
}
function isSearchSuggestion(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        (value.suggestion_type === 'restaurant' || value.suggestion_type === 'dish' || value.suggestion_type === 'hashtag') &&
        typeof value.display_text === 'string' &&
        typeof value.secondary_text === 'string' &&
        nullableString(value.entity_id) &&
        typeof value.score === 'number');
}
function parseSearchSuggestions(value) {
    return Array.isArray(value) ? value.filter(isSearchSuggestion) : [];
}
function parseRankedPostIds(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((row) => (0, safeJson_1.isRecord)(row) && typeof row.id === 'string' && typeof row.rank === 'number');
}
function parseDishPostIds(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((row) => (0, safeJson_1.isRecord)(row) && typeof row.id === 'string' && typeof row.rank === 'number' && typeof row.match_source === 'string');
}
