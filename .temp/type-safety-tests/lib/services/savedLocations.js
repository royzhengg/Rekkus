"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSavedLocationsForUser = fetchSavedLocationsForUser;
exports.normalizeSavedLocations = normalizeSavedLocations;
exports.isSavedLocationList = isSavedLocationList;
exports.fetchSavedRestaurantIds = fetchSavedRestaurantIds;
const boundaryTelemetry_1 = require("@/lib/services/boundaryTelemetry");
const supabase_1 = require("@/lib/supabase");
const safeJson_1 = require("@/lib/utils/safeJson");
const SAVED_LOCATION_SELECT = 'id, restaurant_id, created_at, save_status, restaurants(name, address, latitude, longitude, google_place_id)';
const LEGACY_SAVED_LOCATION_SELECT = 'id, restaurant_id, created_at, restaurants(name, address, latitude, longitude, google_place_id)';
async function fetchSavedLocationsForUser(userId) {
    const query = (select) => supabase_1.supabase
        .from('saved_locations')
        .select(select)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
    const primary = await query(SAVED_LOCATION_SELECT);
    let rows = primary.data;
    let error = primary.error;
    if (error?.message.includes('save_status')) {
        const legacy = await query(LEGACY_SAVED_LOCATION_SELECT);
        rows = legacy.data;
        error = legacy.error;
    }
    if (error)
        throw error;
    const savedLocations = normalizeSavedLocations(rows);
    if (Array.isArray(rows) && savedLocations.length !== rows.length) {
        (0, boundaryTelemetry_1.reportInvalidBoundary)('saved_location_row_invalid');
    }
    return savedLocations;
}
function normalizeSavedLocations(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(parseSavedLocation).filter((row) => row !== null);
}
function isSavedLocationList(value) {
    return Array.isArray(value) && value.every(row => parseSavedLocation(row) !== null);
}
function parseSavedLocation(value) {
    if (!(0, safeJson_1.isRecord)(value) ||
        typeof value.id !== 'string' ||
        typeof value.restaurant_id !== 'string' ||
        typeof value.created_at !== 'string')
        return null;
    const restaurants = value.restaurants;
    const joined = Array.isArray(restaurants) ? restaurants[0] : restaurants;
    if (joined !== null && joined !== undefined && (!(0, safeJson_1.isRecord)(joined) || typeof joined.name !== 'string'))
        return null;
    return {
        id: value.id,
        restaurant_id: value.restaurant_id,
        created_at: value.created_at,
        save_status: value.save_status === 'been_here' ? 'been_here' : 'want_to_try',
        restaurants: joined && (0, safeJson_1.isRecord)(joined) && typeof joined.name === 'string' ? {
            name: joined.name,
            address: typeof joined.address === 'string' ? joined.address : null,
            latitude: typeof joined.latitude === 'number' ? joined.latitude : null,
            longitude: typeof joined.longitude === 'number' ? joined.longitude : null,
            google_place_id: typeof joined.google_place_id === 'string' ? joined.google_place_id : null,
        } : null,
    };
}
async function fetchSavedRestaurantIds(userId) {
    const { data, error } = await supabase_1.supabase
        .from('saved_locations')
        .select('restaurant_id')
        .eq('user_id', userId)
        .limit(200);
    if (error)
        throw error;
    return (data ?? []).map(row => row.restaurant_id);
}
