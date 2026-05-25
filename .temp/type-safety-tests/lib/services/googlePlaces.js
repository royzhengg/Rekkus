"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPlaceAutocompleteJson = fetchPlaceAutocompleteJson;
exports.fetchPlaceDetailsJson = fetchPlaceDetailsJson;
exports.fetchPlaceTextSearchJson = fetchPlaceTextSearchJson;
exports.fetchAreaSuggestionsJson = fetchAreaSuggestionsJson;
exports.buildGooglePlacePhotoUrl = buildGooglePlacePhotoUrl;
const analytics_1 = require("@/lib/analytics");
const config_1 = require("@/lib/config");
const googlePlacesGuards_1 = require("@/lib/services/googlePlacesGuards");
const supabase_1 = require("@/lib/supabase");
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_AUTOCOMPLETE_LENGTH = 2;
const cache = new Map();
const inflight = new Map();
function logProviderUsage(event) {
    void supabase_1.supabase.auth.getUser()
        .then(({ data }) => {
        analytics_1.analytics.providerUsage(data.user?.id ?? null, event.provider, event.requestType, event.feature, event.cacheStatus, event.fallbackReason, event.estimatedCostClass);
        return null;
    })
        .catch(() => {
        analytics_1.analytics.providerUsage(null, event.provider, event.requestType, event.feature, event.cacheStatus, event.fallbackReason, event.estimatedCostClass);
    });
}
async function cachedJson(key, url, event, normalize) {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        logProviderUsage({ ...event, cacheStatus: 'hit' });
        const normalized = normalize(cached.value);
        if (!normalized)
            analytics_1.analytics.actionError(null, 'runtime_boundary', 'google_cache_payload_invalid');
        return normalized;
    }
    const existing = inflight.get(key);
    if (existing) {
        logProviderUsage({ ...event, cacheStatus: 'deduped' });
        const value = await existing;
        return normalize(value);
    }
    logProviderUsage({ ...event, cacheStatus: 'miss' });
    const request = fetch(url)
        .then(async (res) => {
        if (!res.ok)
            throw new Error(`Google Places HTTP ${res.status}`);
        const json = await res.json();
        if (!(0, googlePlacesGuards_1.hasAllowedGoogleStatus)(json))
            throw new Error('Google Places malformed or error status');
        return json;
    })
        .then(json => {
        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: json });
        inflight.delete(key);
        return json;
    })
        .catch(() => {
        inflight.delete(key);
        logProviderUsage({ ...event, cacheStatus: 'error' });
        return null;
    });
    inflight.set(key, request);
    const json = await request;
    const normalized = normalize(json);
    if (json && !normalized)
        analytics_1.analytics.actionError(null, 'runtime_boundary', 'google_response_payload_invalid');
    return normalized;
}
async function fetchPlaceAutocompleteJson(input, location, sessionToken) {
    const q = input.trim();
    const baseEvent = {
        provider: 'google_places',
        requestType: 'autocomplete',
        feature: 'restaurant_search',
        fallbackReason: 'local_miss_or_location_picker',
        estimatedCostClass: 'paid_provider',
    };
    if (!config_1.GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) {
        logProviderUsage({ ...baseEvent, cacheStatus: 'blocked' });
        return { predictions: [] };
    }
    const locationParam = location ? `&location=${location.lat},${location.lng}&radius=10000` : '';
    const sessionTokenParam = sessionToken ? `&sessiontoken=${encodeURIComponent(sessionToken)}` : '';
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}${locationParam}${sessionTokenParam}&types=establishment&key=${config_1.GOOGLE_PLACES_KEY}`;
    return ((await cachedJson(`autocomplete:${q}:${locationParam}:${sessionToken ?? ''}`, url, baseEvent, googlePlacesGuards_1.googlePredictionsEnvelope)) ?? {
        predictions: [],
    });
}
async function fetchPlaceDetailsJson(placeId, fields, guard) {
    if (!config_1.GOOGLE_PLACES_KEY || !placeId)
        return null;
    if (!fields.trim())
        return null;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${config_1.GOOGLE_PLACES_KEY}`;
    return cachedJson(`details:${placeId}:${fields}`, url, {
        provider: 'google_places',
        requestType: 'details',
        feature: 'restaurant_detail',
        fallbackReason: 'missing_or_stale_local_metadata',
        estimatedCostClass: 'paid_provider',
    }, value => (0, googlePlacesGuards_1.googleResultEnvelope)(value, guard));
}
async function fetchPlaceTextSearchJson(query, guard) {
    const q = query.trim();
    if (!config_1.GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH)
        return null;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${config_1.GOOGLE_PLACES_KEY}`;
    return cachedJson(`textsearch:${q}`, url, {
        provider: 'google_places',
        requestType: 'textsearch',
        feature: 'geocode_fallback',
        fallbackReason: 'missing_coordinates',
        estimatedCostClass: 'paid_provider',
    }, value => (0, googlePlacesGuards_1.googleResultsEnvelope)(value, guard));
}
async function fetchAreaSuggestionsJson(input, userLocation) {
    const q = input.trim();
    const baseEvent = {
        provider: 'google_places',
        requestType: 'autocomplete',
        feature: 'area_search',
        fallbackReason: 'suburb_city_postcode_filter',
        estimatedCostClass: 'paid_provider',
    };
    if (!config_1.GOOGLE_PLACES_KEY || q.length < MIN_AUTOCOMPLETE_LENGTH) {
        logProviderUsage({ ...baseEvent, cacheStatus: 'blocked' });
        return { predictions: [] };
    }
    const locationParam = userLocation
        ? `&location=${userLocation.lat},${userLocation.lng}&radius=50000`
        : '';
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}${locationParam}&types=(regions)&key=${config_1.GOOGLE_PLACES_KEY}`;
    const cacheKey = `area:${q}:${locationParam}`;
    const result = await cachedJson(cacheKey, url, baseEvent, googlePlacesGuards_1.googlePredictionsEnvelope);
    return { predictions: (result?.predictions ?? []).filter(googlePlacesGuards_1.isGoogleAreaSuggestion).slice(0, 8) };
}
function buildGooglePlacePhotoUrl(photoReference, maxWidth = 800) {
    if (!config_1.GOOGLE_PLACES_KEY || !photoReference)
        return '';
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${config_1.GOOGLE_PLACES_KEY}`;
}
