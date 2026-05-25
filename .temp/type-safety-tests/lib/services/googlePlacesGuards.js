"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.hasAllowedGoogleStatus = hasAllowedGoogleStatus;
exports.googlePredictionsEnvelope = googlePredictionsEnvelope;
exports.googleResultEnvelope = googleResultEnvelope;
exports.googleResultsEnvelope = googleResultsEnvelope;
exports.isGoogleAreaSuggestion = isGoogleAreaSuggestion;
exports.isGooglePrediction = isGooglePrediction;
exports.isGooglePlaceMetadata = isGooglePlaceMetadata;
exports.isGooglePlaceDetail = isGooglePlaceDetail;
exports.isGoogleTextSearchPlace = isGoogleTextSearchPlace;
exports.isGooglePlaceIdResult = isGooglePlaceIdResult;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasAllowedGoogleStatus(value) {
    if (!isRecord(value))
        return false;
    const status = value.status;
    return status === undefined || status === 'OK' || status === 'ZERO_RESULTS';
}
function googlePredictionsEnvelope(value) {
    if (!isRecord(value))
        return null;
    const predictions = value.predictions;
    return { predictions: Array.isArray(predictions) ? predictions : [] };
}
function googleResultEnvelope(value, guard) {
    if (!isRecord(value))
        return null;
    if (!('result' in value))
        return {};
    return guard(value.result) ? { result: value.result } : {};
}
function googleResultsEnvelope(value, guard) {
    if (!isRecord(value))
        return null;
    const results = value.results;
    return { results: Array.isArray(results) ? results.filter(guard) : [] };
}
function isGoogleAreaSuggestion(value) {
    if (!isRecord(value) || !isRecord(value.structured_formatting))
        return false;
    return (typeof value.place_id === 'string' &&
        typeof value.description === 'string' &&
        typeof value.structured_formatting.main_text === 'string' &&
        typeof value.structured_formatting.secondary_text === 'string');
}
function isGooglePrediction(value) {
    if (!isRecord(value))
        return false;
    const types = value.types;
    if (!isGoogleAreaSuggestion(value))
        return false;
    return types === undefined || (Array.isArray(types) &&
        types.every((type) => typeof type === 'string'));
}
function isLocation(value) {
    return isRecord(value) && typeof value.lat === 'number' && typeof value.lng === 'number';
}
function isGeometry(value) {
    return isRecord(value) && isLocation(value.location);
}
function isPhoto(value) {
    return isRecord(value) && (value.photo_reference === undefined || typeof value.photo_reference === 'string');
}
function isOpeningHours(value) {
    return isRecord(value) &&
        (value.open_now === undefined || typeof value.open_now === 'boolean') &&
        (value.weekday_text === undefined || (Array.isArray(value.weekday_text) && value.weekday_text.every(text => typeof text === 'string')));
}
function isGooglePlaceMetadata(value) {
    if (!isRecord(value))
        return false;
    if (value.name !== undefined && typeof value.name !== 'string')
        return false;
    if (value.formatted_address !== undefined && typeof value.formatted_address !== 'string')
        return false;
    if (value.geometry !== undefined && !isGeometry(value.geometry))
        return false;
    if (value.business_status !== undefined && typeof value.business_status !== 'string')
        return false;
    if (value.formatted_phone_number !== undefined && typeof value.formatted_phone_number !== 'string')
        return false;
    if (value.website !== undefined && typeof value.website !== 'string')
        return false;
    if (value.price_level !== undefined && typeof value.price_level !== 'number')
        return false;
    if (value.rating !== undefined && typeof value.rating !== 'number')
        return false;
    if (value.user_ratings_total !== undefined && typeof value.user_ratings_total !== 'number')
        return false;
    if (value.types !== undefined && (!Array.isArray(value.types) || !value.types.every(type => typeof type === 'string')))
        return false;
    if (value.photos !== undefined && (!Array.isArray(value.photos) || !value.photos.every(isPhoto)))
        return false;
    if (value.opening_hours !== undefined && !isOpeningHours(value.opening_hours))
        return false;
    return true;
}
function isGooglePlaceDetail(value) {
    return (isGooglePlaceMetadata(value) &&
        typeof value.name === 'string' &&
        typeof value.formatted_address === 'string' &&
        isGeometry(value.geometry));
}
function isGoogleTextSearchPlace(value) {
    return isRecord(value) && typeof value.place_id === 'string' && isGooglePlaceDetail(value);
}
function isGooglePlaceIdResult(value) {
    return isRecord(value) && typeof value.place_id === 'string';
}
