"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSavedLocations = exports.isSavedLocationList = exports.fetchSavedRestaurantIds = exports.fetchSavedLocationsForUser = exports.submitRestaurantEditSuggestion = exports.submitRestaurantClaim = exports.submitDuplicateRestaurantSuggestion = exports.submitCommunityVerification = exports.reportDataRepair = exports.recordRestaurantObservation = exports.recordRestaurantMergeEvidence = exports.recordRestaurantAuditEvent = exports.recordRestaurantAlias = void 0;
exports.fetchPredictions = fetchPredictions;
exports.searchRestaurantsByText = searchRestaurantsByText;
exports.fetchNearbyRestaurants = fetchNearbyRestaurants;
exports.fetchPlaceDetails = fetchPlaceDetails;
exports.fetchRestaurantProviderDetail = fetchRestaurantProviderDetail;
exports.fetchPlaceIdByTextSearch = fetchPlaceIdByTextSearch;
exports.getRestaurantProviderPhotoUrl = getRestaurantProviderPhotoUrl;
exports.findRestaurantByGooglePlaceId = findRestaurantByGooglePlaceId;
exports.searchLocalRestaurants = searchLocalRestaurants;
exports.upsertRestaurant = upsertRestaurant;
exports.upsertResolvedRestaurant = upsertResolvedRestaurant;
exports.saveLocation = saveLocation;
exports.unsaveLocation = unsaveLocation;
exports.createUserRestaurant = createUserRestaurant;
exports.getRestaurantDisplayPhotos = getRestaurantDisplayPhotos;
exports.getRestaurantDisplayPhoto = getRestaurantDisplayPhoto;
exports.recordRestaurantSource = recordRestaurantSource;
exports.recordRestaurantProviderCache = recordRestaurantProviderCache;
exports.fetchRestaurantRow = fetchRestaurantRow;
exports.fetchRestaurantRowByPlaceId = fetchRestaurantRowByPlaceId;
exports.cacheRestaurantGoogleData = cacheRestaurantGoogleData;
exports.fetchRestaurantPostRatings = fetchRestaurantPostRatings;
exports.fetchIsLocationSaved = fetchIsLocationSaved;
exports.fetchPopularityCache = fetchPopularityCache;
exports.insertGoogleRestaurant = insertGoogleRestaurant;
const boundaryTelemetry_1 = require("@/lib/services/boundaryTelemetry");
const googlePlaces_1 = require("@/lib/services/googlePlaces");
const googlePlacesGuards_1 = require("@/lib/services/googlePlacesGuards");
const supabase_1 = require("@/lib/supabase");
const safeJson_1 = require("@/lib/utils/safeJson");
var governance_1 = require("./restaurants/governance");
Object.defineProperty(exports, "recordRestaurantAlias", { enumerable: true, get: function () { return governance_1.recordRestaurantAlias; } });
Object.defineProperty(exports, "recordRestaurantAuditEvent", { enumerable: true, get: function () { return governance_1.recordRestaurantAuditEvent; } });
Object.defineProperty(exports, "recordRestaurantMergeEvidence", { enumerable: true, get: function () { return governance_1.recordRestaurantMergeEvidence; } });
Object.defineProperty(exports, "recordRestaurantObservation", { enumerable: true, get: function () { return governance_1.recordRestaurantObservation; } });
Object.defineProperty(exports, "reportDataRepair", { enumerable: true, get: function () { return governance_1.reportDataRepair; } });
Object.defineProperty(exports, "submitCommunityVerification", { enumerable: true, get: function () { return governance_1.submitCommunityVerification; } });
Object.defineProperty(exports, "submitDuplicateRestaurantSuggestion", { enumerable: true, get: function () { return governance_1.submitDuplicateRestaurantSuggestion; } });
Object.defineProperty(exports, "submitRestaurantClaim", { enumerable: true, get: function () { return governance_1.submitRestaurantClaim; } });
Object.defineProperty(exports, "submitRestaurantEditSuggestion", { enumerable: true, get: function () { return governance_1.submitRestaurantEditSuggestion; } });
var savedLocations_1 = require("./savedLocations");
Object.defineProperty(exports, "fetchSavedLocationsForUser", { enumerable: true, get: function () { return savedLocations_1.fetchSavedLocationsForUser; } });
Object.defineProperty(exports, "fetchSavedRestaurantIds", { enumerable: true, get: function () { return savedLocations_1.fetchSavedRestaurantIds; } });
Object.defineProperty(exports, "isSavedLocationList", { enumerable: true, get: function () { return savedLocations_1.isSavedLocationList; } });
Object.defineProperty(exports, "normalizeSavedLocations", { enumerable: true, get: function () { return savedLocations_1.normalizeSavedLocations; } });
async function fetchPredictions(input, userLocation) {
    const json = await (0, googlePlaces_1.fetchPlaceAutocompleteJson)(input, userLocation);
    const predictions = json.predictions ?? [];
    const validPredictions = predictions.filter(googlePlacesGuards_1.isGooglePrediction);
    if (validPredictions.length !== predictions.length) {
        (0, boundaryTelemetry_1.reportInvalidBoundary)('google_prediction_item_invalid');
    }
    return validPredictions.map(prediction => ({
        ...prediction,
        source: 'google',
        score: 0,
    }));
}
async function searchRestaurantsByText(query, maxResults = 8) {
    const { data } = await supabase_1.supabase.rpc('search_restaurants_full_text', {
        query_text: query,
        max_results: maxResults,
    });
    return (data ?? []).map((r) => ({
        place_id: r.google_place_id ?? r.id,
        description: r.name,
        structured_formatting: {
            main_text: r.name,
            secondary_text: [r.cuisine_type, r.suburb ?? r.city, r.address].filter(Boolean).slice(0, 3).join(' · '),
        },
        types: ['restaurant'],
        source: 'rekkus',
        score: Number(r.rank ?? 0) + 10,
        dbDetails: {
            restaurantId: r.id,
            lat: r.latitude ?? 0,
            lng: r.longitude ?? 0,
            address: r.address ?? '',
            suburb: r.suburb ?? null,
            city: r.city ?? null,
            cuisineType: r.cuisine_type ?? null,
        },
    }));
}
async function fetchNearbyRestaurants(location, radiusKm = 1) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01));
    const { data } = await supabase_1.supabase.rpc('restaurants_in_bounding_box', {
        min_lat: location.lat - latDelta,
        max_lat: location.lat + latDelta,
        min_lng: location.lng - lngDelta,
        max_lng: location.lng + lngDelta,
        max_results: 8,
    });
    return (data ?? []).map((r) => ({
        place_id: r.google_place_id ?? r.id,
        description: r.name,
        structured_formatting: {
            main_text: r.name,
            secondary_text: [r.cuisine_type, r.city, r.address].filter(Boolean).slice(0, 3).join(' · '),
        },
        types: ['restaurant'],
        source: 'rekkus',
        score: 10,
        dbDetails: {
            restaurantId: r.id,
            lat: r.latitude ?? 0,
            lng: r.longitude ?? 0,
            address: r.address ?? '',
            suburb: null,
            city: r.city ?? null,
            cuisineType: r.cuisine_type ?? null,
        },
    }));
}
async function fetchPlaceDetails(placeId) {
    const json = await (0, googlePlaces_1.fetchPlaceDetailsJson)(placeId, 'name,formatted_address,geometry,business_status,formatted_phone_number,website,price_level,types,opening_hours,photos,rating,user_ratings_total', googlePlacesGuards_1.isGooglePlaceDetail);
    return json?.result ?? null;
}
async function fetchRestaurantProviderDetail(placeId, fields) {
    try {
        const json = await (0, googlePlaces_1.fetchPlaceDetailsJson)(placeId, fields, googlePlacesGuards_1.isGooglePlaceMetadata);
        return json?.result ?? null;
    }
    catch {
        return null;
    }
}
async function fetchPlaceIdByTextSearch(query) {
    try {
        const json = await (0, googlePlaces_1.fetchPlaceTextSearchJson)(query, googlePlacesGuards_1.isGooglePlaceIdResult);
        return json?.results?.[0]?.place_id ?? null;
    }
    catch {
        return null;
    }
}
function getRestaurantProviderPhotoUrl(photoReference, maxWidth = 800) {
    return (0, googlePlaces_1.buildGooglePlacePhotoUrl)(photoReference, maxWidth);
}
async function findRestaurantByGooglePlaceId(placeId) {
    if (!placeId)
        return null;
    const { data } = await supabase_1.supabase.from('restaurants')
        .select('*')
        .eq('google_place_id', placeId)
        .maybeSingle();
    return data ?? null;
}
async function searchLocalRestaurants(query, limit = 10) {
    const q = query.trim();
    if (!q)
        return [];
    const { data } = await supabase_1.supabase.from('restaurants')
        .select('*')
        .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,cuisine_type.ilike.%${q}%`)
        .limit(limit);
    return data ?? [];
}
async function upsertRestaurant(detail, placeId, cuisine) {
    const now = new Date().toISOString();
    const { data } = await supabase_1.supabase.from('restaurants')
        .upsert({
        name: detail.name,
        address: detail.formatted_address,
        latitude: detail.geometry.location.lat,
        longitude: detail.geometry.location.lng,
        google_place_id: placeId,
        cuisine_type: cuisine ?? null,
        canonical_source: 'google_places',
        google_details_fetched_at: now,
        google_details_fields: [
            'name',
            'formatted_address',
            'geometry',
            'business_status',
            'formatted_phone_number',
            'website',
            'price_level',
            'types',
            'opening_hours',
            'photos',
            'rating',
            'user_ratings_total',
        ],
        google_business_status: detail.business_status ?? null,
        google_phone: detail.formatted_phone_number ?? null,
        google_website: detail.website ?? null,
        google_price_level: detail.price_level ?? null,
        google_types: detail.types ?? null,
        google_opening_hours: (detail.opening_hours ?? null),
        google_photo_refs: (detail.photos?.map(p => p.photo_reference).filter((r) => r != null) ?? null),
        google_rating: detail.rating ?? null,
        google_review_count: detail.user_ratings_total ?? null,
        updated_at: now,
    }, { onConflict: 'google_place_id' })
        .select('id')
        .single();
    const restaurantId = data?.id;
    if (!restaurantId)
        return undefined;
    await recordRestaurantProviderCache(restaurantId, 'google_places', placeId, detail).catch(() => null);
    return restaurantId;
}
async function upsertResolvedRestaurant(place) {
    const { data, error } = await supabase_1.supabase.from('restaurants')
        .upsert({
        name: place.name,
        address: place.address,
        latitude: place.lat,
        longitude: place.lng,
        google_place_id: place.placeId,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'google_place_id' })
        .select('id')
        .single();
    if (error)
        throw error;
    return data?.id ?? null;
}
async function saveLocation(userId, restaurantId) {
    const { error } = await supabase_1.supabase.from('saved_locations').insert({
        user_id: userId,
        restaurant_id: restaurantId,
    });
    if (error)
        throw error;
}
async function unsaveLocation(userId, restaurantId) {
    const { error } = await supabase_1.supabase.from('saved_locations')
        .delete()
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId);
    if (error)
        throw error;
}
async function createUserRestaurant(input) {
    const { data, error } = await supabase_1.supabase.rpc('create_user_restaurant', {
        p_name: input.name,
        ...(input.address ? { p_address: input.address } : {}),
        ...(input.city ? { p_city: input.city } : {}),
        ...(input.country ? { p_country: input.country } : {}),
        ...(input.latitude != null ? { p_latitude: input.latitude } : {}),
        ...(input.longitude != null ? { p_longitude: input.longitude } : {}),
        ...(input.cuisineType ? { p_cuisine_type: input.cuisineType } : {}),
    });
    if (error)
        return null;
    return data ?? null;
}
async function getRestaurantDisplayPhotos(restaurantId, providerPhotoRefs = [], maxPhotos = 6) {
    const providerUrls = providerPhotoRefs
        .slice(0, maxPhotos)
        .map(ref => getRestaurantProviderPhotoUrl(ref))
        .filter(Boolean);
    if (!restaurantId)
        return providerUrls;
    const { data } = await supabase_1.supabase.from('posts')
        .select('post_photos ( url, order_index )')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(24);
    const firstPartyUrls = (data ?? [])
        .flatMap((row) => row.post_photos ?? [])
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map(photo => photo.url)
        .filter((url, index, arr) => typeof url === 'string' && !!url && arr.indexOf(url) === index)
        .slice(0, maxPhotos);
    return firstPartyUrls.length > 0 ? firstPartyUrls : providerUrls;
}
async function getRestaurantDisplayPhoto(restaurantId, providerPhotoRefs = []) {
    const photos = await getRestaurantDisplayPhotos(restaurantId, providerPhotoRefs, 1);
    return photos[0] ?? null;
}
async function recordRestaurantSource(restaurantId, sourceType, sourceId, options = {}) {
    if (!restaurantId || !sourceId)
        return;
    await supabase_1.supabase.from('restaurant_sources').upsert({
        restaurant_id: restaurantId,
        source_type: sourceType,
        source_id: sourceId,
        source_rights: options.source_rights ?? 'first_party',
        attribution_required: options.attribution_required ?? false,
        cacheability: options.cacheability ?? 'permanent_identifier',
        retention_policy: options.retention_policy ?? 'retain_until_unlinked_or_restaurant_deleted',
        confidence: options.confidence ?? 0.5,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id' });
}
async function recordRestaurantProviderCache(restaurantId, sourceType, sourceId, detail) {
    if (!restaurantId || !sourceId)
        return;
    const now = new Date();
    const staleAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase_1.supabase.rpc('record_restaurant_provider_snapshot', {
        p_restaurant_id: restaurantId,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_field_mask: [
            'name',
            'formatted_address',
            'geometry',
            'business_status',
            'formatted_phone_number',
            'website',
            'price_level',
            'types',
            'opening_hours',
            'photos',
            'rating',
            'user_ratings_total',
        ],
        p_normalized_payload: {
            name: detail.name,
            formatted_address: detail.formatted_address,
            lat: detail.geometry.location.lat,
            lng: detail.geometry.location.lng,
            business_status: detail.business_status ?? null,
            phone: detail.formatted_phone_number ?? null,
            website: detail.website ?? null,
            price_level: detail.price_level ?? null,
            types: detail.types ?? [],
            rating: detail.rating ?? null,
            user_ratings_total: detail.user_ratings_total ?? null,
        },
        p_attribution_required: sourceType === 'google_places',
        p_attribution_text: sourceType === 'google_places' ? 'Google' : '',
        p_cacheability: sourceType === 'google_places'
            ? 'place_id_permanent_content_restricted'
            : 'source_terms_defined',
        p_retention_policy: sourceType === 'google_places'
            ? 'retain_place_id_refresh_content_by_terms'
            : 'retain_until_source_or_restaurant_deleted',
        p_stale_at: staleAt,
    });
}
function parseRestaurantRow(value) {
    if (!(0, safeJson_1.isRecord)(value) || typeof value.id !== 'string')
        return null;
    return {
        id: value.id,
        google_place_id: typeof value.google_place_id === 'string' ? value.google_place_id : null,
        google_photo_refs: Array.isArray(value.google_photo_refs)
            ? value.google_photo_refs.filter((ref) => typeof ref === 'string')
            : [],
    };
}
async function fetchRestaurantRow(id) {
    const { data } = await supabase_1.supabase.from('restaurants')
        .select('id, google_place_id, google_photo_refs')
        .eq('id', id)
        .maybeSingle();
    return parseRestaurantRow(data);
}
async function fetchRestaurantRowByPlaceId(placeId) {
    const { data } = await supabase_1.supabase.from('restaurants')
        .select('id, google_place_id, google_photo_refs')
        .eq('google_place_id', placeId)
        .maybeSingle();
    return parseRestaurantRow(data);
}
function cacheRestaurantGoogleData(restaurantId, data) {
    void supabase_1.supabase.from('restaurants').update(data).eq('id', restaurantId);
}
async function fetchRestaurantPostRatings(restaurantId) {
    const { data } = await supabase_1.supabase.from('posts')
        .select('food_rating, vibe_rating, cost_rating, created_at, best_dish, dish_id')
        .eq('restaurant_id', restaurantId)
        .limit(100);
    return (data ?? []).filter((row) => typeof row.created_at === 'string' &&
        (row.food_rating === null || typeof row.food_rating === 'number') &&
        (row.vibe_rating === null || typeof row.vibe_rating === 'number') &&
        (row.cost_rating === null || typeof row.cost_rating === 'number') &&
        (row.best_dish === null || typeof row.best_dish === 'string') &&
        (row.dish_id === null || typeof row.dish_id === 'string'));
}
async function fetchIsLocationSaved(userId, restaurantId) {
    const { data } = await supabase_1.supabase.from('saved_locations')
        .select('id')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
    return !!data;
}
async function fetchPopularityCache(limit = 2000) {
    const { data, error } = await supabase_1.supabase
        .from('restaurant_popularity_cache')
        .select('restaurant_id, post_count, interaction_count_30d, avg_food_rating, food_rating_count')
        .limit(limit);
    if (error)
        throw error;
    return data ?? [];
}
async function insertGoogleRestaurant(input) {
    const { data } = await supabase_1.supabase.from('restaurants')
        .insert({
        name: input.name,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        google_place_id: input.google_place_id,
        canonical_source: 'google_places',
    })
        .select('id')
        .single();
    return data?.id ?? null;
}
