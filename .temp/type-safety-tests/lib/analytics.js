"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analytics = void 0;
exports.sanitizeAnalyticsMetadata = sanitizeAnalyticsMetadata;
const supabase_1 = require("@/lib/supabase");
const cooldown_1 = require("@/lib/utils/cooldown");
const SAFE_METADATA_KEYS = new Set([
    'query',
    'result_count',
    'rejected_count',
    'screen',
    'source',
    'surface',
    'step',
    'outcome',
    'reason',
    'provider',
    'action',
    'target_type',
    'restaurant_id',
    'post_id',
    'place_id',
    'cuisine_type',
    'fallback_reason',
    'cache_state',
    'cost_class',
    'duration_ms',
    'feed_tab',
    'position',
    'query_position',
    'previous_query',
    'radius_km',
    'result_position',
    'result_type',
    'search_mode',
    'search_session_id',
    'status',
    'topic',
    'collection_id',
    'collection_visibility',
    'filter_type',
    'filter_id',
    'visible_count',
    'media_type',
    'media_count',
    'progress',
    'sort',
    'filter_count',
    'taste_verdict',
    'value_verdict',
    'occasion',
    'modal_id',
    'option_id',
    'share_target',
    'changed_field_count',
    'draft_state',
    'error_class',
    'target_state',
    'comment_depth',
    'list_type',
    'map_action',
    'request_state',
    'field_count',
    'request_type',
    'feature',
    'cache_status',
]);
const SENSITIVE_VALUE_PATTERN = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}|password|secret|token|service_role|reset_link|private_note|raw_provider_payload|precise_location)/i;
const MAX_METADATA_STRING_LENGTH = 120;
function sanitizeAnalyticsMetadata(metadata) {
    if (!metadata)
        return undefined;
    const safe = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!SAFE_METADATA_KEYS.has(key))
            continue;
        if (value === null || typeof value === 'boolean' || typeof value === 'number') {
            safe[key] = value;
            continue;
        }
        if (typeof value !== 'string')
            continue;
        const trimmed = value.trim().slice(0, MAX_METADATA_STRING_LENGTH);
        safe[key] = SENSITIVE_VALUE_PATTERN.test(trimmed) ? '[redacted]' : trimmed;
    }
    return Object.keys(safe).length ? safe : undefined;
}
async function track(userId, payload) {
    try {
        const sampleRate = Math.max(0, Math.min(1, payload.sampleRate ?? 1));
        if (sampleRate <= 0 || Math.random() > sampleRate)
            return;
        const metadata = sanitizeAnalyticsMetadata(payload.metadata);
        const identity = userId ?? 'anonymous';
        const entity = payload.entity_id ?? JSON.stringify(metadata ?? {});
        if ((0, cooldown_1.isCoolingDown)(`analytics:${identity}:${payload.event_type}:${entity}`, 15_000))
            return;
        const eventVersion = Math.max(1, Math.floor(payload.eventVersion ?? 1));
        await supabase_1.supabase.from('analytics_events').insert({
            user_id: userId,
            event_type: payload.event_type,
            event_version: eventVersion,
            ...(payload.entity_type ? { entity_type: payload.entity_type } : {}),
            ...(payload.entity_id ? { entity_id: payload.entity_id } : {}),
            ...(metadata ? { metadata } : {}),
        });
    }
    catch {
        // analytics must never crash the app
    }
}
exports.analytics = {
    // Post events
    viewPost: (userId, postId) => void track(userId, { event_type: 'post_view', entity_type: 'post', entity_id: postId }),
    likePost: (userId, postId) => void track(userId, { event_type: 'post_like', entity_type: 'post', entity_id: postId }),
    savePost: (userId, postId) => void track(userId, { event_type: 'post_save', entity_type: 'post', entity_id: postId }),
    dwellPost: (userId, postId, durationMs) => void track(userId, {
        event_type: 'post_dwell',
        entity_type: 'post',
        entity_id: postId,
        metadata: { duration_ms: Math.max(0, Math.round(durationMs)) },
    }),
    commentPost: (userId, postId) => void track(userId, { event_type: 'post_comment', entity_type: 'post', entity_id: postId }),
    // Place events
    viewPlace: (userId, restaurantId, query) => void track(userId, {
        event_type: 'place_view',
        entity_type: 'restaurant',
        entity_id: restaurantId,
        metadata: { query },
    }),
    clickPlace: (userId, restaurantId) => void track(userId, {
        event_type: 'place_click',
        entity_type: 'restaurant',
        entity_id: restaurantId,
    }),
    savePlace: (userId, restaurantId) => void track(userId, { event_type: 'place_save', entity_type: 'restaurant', entity_id: restaurantId }),
    revisitPlace: (userId, restaurantId, source) => void track(userId, {
        event_type: 'restaurant_revisit',
        entity_type: 'restaurant',
        entity_id: restaurantId,
        metadata: { source },
    }),
    // Search events
    search: (userId, query, resultCount) => void track(userId, { event_type: 'search', metadata: { query, result_count: resultCount } }),
    searchQuery: (userId, query, resultCount, searchSessionId, queryPosition, metadata) => void track(userId, {
        event_type: 'search_query',
        metadata: {
            query,
            result_count: resultCount,
            search_session_id: searchSessionId,
            query_position: queryPosition,
            ...metadata,
        },
    }),
    dismissSearchQuery: (userId, query) => {
        void (async () => {
            try {
                await supabase_1.supabase.from('analytics_events')
                    .delete()
                    .eq('user_id', userId)
                    .eq('event_type', 'search_query')
                    .filter('metadata->>query', 'ilike', query);
            }
            catch {
                // analytics history cleanup must never crash the app
            }
        })();
    },
    searchResultClick: (userId, resultType, entityId, query, position, searchSessionId) => void track(userId, {
        event_type: 'search_result_click',
        entity_type: resultType === 'restaurant' ? 'restaurant' : resultType,
        entity_id: entityId,
        metadata: {
            query,
            result_type: resultType,
            result_position: position,
            search_session_id: searchSessionId,
        },
    }),
    feedDiagnostic: (userId, action, feedTab, visibleCount, resultCount) => void track(userId, {
        event_type: 'feed_diagnostic',
        sampleRate: 0.1,
        metadata: {
            action,
            feed_tab: feedTab,
            visible_count: visibleCount,
            result_count: resultCount,
        },
    }),
    collectionInteraction: (userId, action, collectionId, metadata) => void track(userId, {
        event_type: 'collection_interaction',
        ...(collectionId ? { entity_type: 'collection', entity_id: collectionId } : {}),
        metadata: { action, collection_id: collectionId, ...metadata },
    }),
    // User events
    follow: (userId, targetUserId) => void track(userId, { event_type: 'user_follow', entity_type: 'user', entity_id: targetUserId }),
    screen: (userId, screenName) => void track(userId, { event_type: 'screen_view', metadata: { screen: screenName } }),
    onboardingStep: (userId, step, outcome, reason) => void track(userId, { event_type: 'onboarding_step', metadata: { step, outcome, reason } }),
    onboardingAnomaly: (userId, step, reason) => void track(userId, { event_type: 'onboarding_anomaly', metadata: { step, reason } }),
    uploadFailure: (userId, surface, reason, rejectedCount) => void track(userId, {
        event_type: 'upload_failure',
        metadata: { surface, reason, rejected_count: rejectedCount },
    }),
    mediaEvent: (userId, eventType, surface, metadata) => void track(userId, {
        event_type: eventType,
        metadata: { surface, ...metadata },
    }),
    searchFilter: (userId, action, filterType, filterId) => void track(userId, {
        event_type: action === 'applied' ? 'search_filter_applied' : 'search_filter_removed',
        metadata: { filter_type: filterType, filter_id: filterId },
    }),
    rekkusPickSelected: (userId, filterType, filterId) => void track(userId, {
        event_type: 'rekkus_pick_selected',
        metadata: { filter_type: filterType, filter_id: filterId },
    }),
    abuseSignal: (userId, action, targetType, reason) => void track(userId, {
        event_type: 'abuse_signal',
        metadata: { action, target_type: targetType, reason },
    }),
    createLauncher: (userId, action) => void track(userId, {
        event_type: 'create_launcher',
        metadata: { action },
    }),
    postEdit: (userId, postId, action, changedFieldCount) => void track(userId, {
        event_type: 'post_edit',
        entity_type: 'post',
        entity_id: postId,
        metadata: { action, changed_field_count: changedFieldCount },
    }),
    modalAction: (userId, modalId, optionId) => void track(userId, {
        event_type: 'modal_action',
        metadata: { modal_id: modalId, option_id: optionId },
    }),
    postShare: (userId, postId, shareTarget) => void track(userId, {
        event_type: 'post_share',
        entity_type: 'post',
        entity_id: postId,
        metadata: { share_target: shareTarget },
    }),
    actionError: (userId, action, errorClass) => void track(userId, {
        event_type: 'action_error',
        metadata: { action, error_class: errorClass },
    }),
    providerUsage: (userId, provider, requestType, feature, cacheStatus, fallbackReason, costClass) => {
        const eventTypeByStatus = {
            hit: 'provider_cache_hit',
            miss: 'provider_cache_miss',
            deduped: 'provider_request_deduped',
            blocked: 'provider_request_blocked',
            error: 'provider_request_error',
        };
        void track(userId, {
            event_type: eventTypeByStatus[cacheStatus],
            entity_type: 'restaurant',
            sampleRate: userId ? 1 : 0.1,
            metadata: {
                provider,
                request_type: requestType,
                feature,
                cache_status: cacheStatus,
                fallback_reason: fallbackReason,
                cost_class: costClass,
            },
        });
    },
};
