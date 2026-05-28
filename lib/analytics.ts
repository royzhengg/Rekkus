import { supabase } from '@/lib/supabase'
import { isCoolingDown } from '@/lib/utils/cooldown'

type EntityType = 'restaurant' | 'post' | 'user' | 'collection' | 'dish'

type EventPayload = {
  event_type: string
  entity_type?: EntityType | undefined
  entity_id?: string | undefined
  metadata?: Record<string, unknown> | undefined
  eventVersion?: number | undefined
  sampleRate?: number | undefined
}

type ProviderCacheState = 'hit' | 'miss' | 'deduped' | 'blocked' | 'error'

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
  'mutation_kind',
])
const SENSITIVE_VALUE_PATTERN =
  /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{7,}|password|secret|token|service_role|reset_link|private_note|raw_provider_payload|precise_location)/i
const MAX_METADATA_STRING_LENGTH = 120

export function sanitizeAnalyticsMetadata(
  metadata?: Record<string, unknown>
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined

  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      safe[key] = value
      continue
    }
    if (typeof value !== 'string') continue

    const trimmed = value.trim().slice(0, MAX_METADATA_STRING_LENGTH)
    safe[key] = SENSITIVE_VALUE_PATTERN.test(trimmed) ? '[redacted]' : trimmed
  }

  return Object.keys(safe).length ? safe : undefined
}

async function track(userId: string | null, payload: EventPayload): Promise<void> {
  try {
    const sampleRate = Math.max(0, Math.min(1, payload.sampleRate ?? 1))
    if (sampleRate <= 0 || Math.random() > sampleRate) return

    const metadata = sanitizeAnalyticsMetadata(payload.metadata)
    const identity = userId ?? 'anonymous'
    const entity = payload.entity_id ?? JSON.stringify(metadata ?? {})
    if (isCoolingDown(`analytics:${identity}:${payload.event_type}:${entity}`, 15_000)) return
    const eventVersion = Math.max(1, Math.floor(payload.eventVersion ?? 1))
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_type: payload.event_type,
      event_version: eventVersion,
      ...(payload.entity_type ? { entity_type: payload.entity_type } : {}),
      ...(payload.entity_id ? { entity_id: payload.entity_id } : {}),
      ...(metadata ? { metadata } : {}),
    })
  } catch {
    // analytics must never crash the app
  }
}

export const analytics = {
  // Post events
  viewPost: (userId: string | null, postId: string): void =>
    void track(userId, { event_type: 'post_view', entity_type: 'post', entity_id: postId }),

  likePost: (userId: string, postId: string): void =>
    void track(userId, { event_type: 'post_like', entity_type: 'post', entity_id: postId }),

  savePost: (userId: string, postId: string): void =>
    void track(userId, { event_type: 'post_save', entity_type: 'post', entity_id: postId }),

  viewDish: (userId: string | null, dishId: string): void =>
    void track(userId, { event_type: 'dish_view', entity_type: 'dish', entity_id: dishId }),

  saveDish: (userId: string, dishId: string): void =>
    void track(userId, { event_type: 'dish_save', entity_type: 'dish', entity_id: dishId }),

  // Privacy: only userId, mutationKind (enum), and outcome are permitted.
  // Banned: message body, post captions, profile values, media URLs, collection names, report/moderation content.
  offlineMutation: (userId: string, mutationKind: string, outcome: 'queued' | 'synced' | 'sync_failed'): void =>
    void track(userId, {
      event_type: 'offline_mutation_sync',
      metadata: { mutation_kind: mutationKind, outcome },
    }),

  dwellPost: (userId: string | null, postId: string, durationMs: number): void =>
    void track(userId, {
      event_type: 'post_dwell',
      entity_type: 'post',
      entity_id: postId,
      metadata: { duration_ms: Math.max(0, Math.round(durationMs)) },
    }),

  commentPost: (userId: string, postId: string): void =>
    void track(userId, { event_type: 'post_comment', entity_type: 'post', entity_id: postId }),

  // Place events
  viewPlace: (userId: string | null, restaurantId: string, query?: string): void =>
    void track(userId, {
      event_type: 'place_view',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      metadata: { query },
    }),

  clickPlace: (userId: string | null, restaurantId: string): void =>
    void track(userId, {
      event_type: 'place_click',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    }),

  savePlace: (userId: string, restaurantId: string): void =>
    void track(userId, { event_type: 'place_save', entity_type: 'restaurant', entity_id: restaurantId }),

  revisitPlace: (userId: string | null, restaurantId: string, source: string): void =>
    void track(userId, {
      event_type: 'restaurant_revisit',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      metadata: { source },
    }),

  // Search events
  search: (userId: string | null, query: string, resultCount: number): void =>
    void track(userId, { event_type: 'search', metadata: { query, result_count: resultCount } }),

  searchQuery: (
    userId: string | null,
    query: string,
    resultCount: number,
    searchSessionId: string,
    queryPosition: number,
    metadata?: Record<string, unknown>
  ): void =>
    void track(userId, {
      event_type: 'search_query',
      metadata: {
        query,
        result_count: resultCount,
        search_session_id: searchSessionId,
        query_position: queryPosition,
        ...metadata,
      },
    }),

  dismissSearchQuery: (userId: string, query: string): void => {
    void (async () => {
      try {
        await supabase.from('analytics_events')
          .delete()
          .eq('user_id', userId)
          .eq('event_type', 'search_query')
          .filter('metadata->>query', 'ilike', query)
      } catch {
        // analytics history cleanup must never crash the app
      }
    })()
  },

  searchResultClick: (
    userId: string | null,
    resultType: 'post' | 'restaurant' | 'user',
    entityId: string,
    query: string,
    position: number,
    searchSessionId: string
  ): void =>
    void track(userId, {
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

  feedDiagnostic: (
    userId: string | null,
    action: string,
    feedTab: string,
    visibleCount: number,
    resultCount: number
  ): void =>
    void track(userId, {
      event_type: 'feed_diagnostic',
      sampleRate: 0.1,
      metadata: {
        action,
        feed_tab: feedTab,
        visible_count: visibleCount,
        result_count: resultCount,
      },
    }),

  collectionInteraction: (
    userId: string | null,
    action: string,
    collectionId?: string,
    metadata?: Record<string, unknown>
  ): void =>
    void track(userId, {
      event_type: 'collection_interaction',
      ...(collectionId ? { entity_type: 'collection' as const, entity_id: collectionId } : {}),
      metadata: { action, collection_id: collectionId, ...metadata },
    }),

  // User events
  follow: (userId: string, targetUserId: string): void =>
    void track(userId, { event_type: 'user_follow', entity_type: 'user', entity_id: targetUserId }),

  screen: (userId: string | null, screenName: string): void =>
    void track(userId, { event_type: 'screen_view', metadata: { screen: screenName } }),

  onboardingStep: (userId: string | null, step: string, outcome: string, reason?: string): void =>
    void track(userId, { event_type: 'onboarding_step', metadata: { step, outcome, reason } }),

  onboardingAnomaly: (userId: string | null, step: string, reason: string): void =>
    void track(userId, { event_type: 'onboarding_anomaly', metadata: { step, reason } }),

  uploadFailure: (userId: string | null, surface: string, reason: string, rejectedCount?: number): void =>
    void track(userId, {
      event_type: 'upload_failure',
      metadata: { surface, reason, rejected_count: rejectedCount },
    }),

  mediaEvent: (
    userId: string | null,
    eventType: string,
    surface: string,
    metadata?: Record<string, unknown>
  ): void =>
    void track(userId, {
      event_type: eventType,
      metadata: { surface, ...metadata },
    }),

  searchFilter: (userId: string | null, action: 'applied' | 'removed', filterType: string, filterId?: string): void =>
    void track(userId, {
      event_type: action === 'applied' ? 'search_filter_applied' : 'search_filter_removed',
      metadata: { filter_type: filterType, filter_id: filterId },
    }),

  rekkusPickSelected: (userId: string | null, filterType: string, filterId: string): void =>
    void track(userId, {
      event_type: 'rekkus_pick_selected',
      metadata: { filter_type: filterType, filter_id: filterId },
    }),

  abuseSignal: (userId: string | null, action: string, targetType: string, reason: string): void =>
    void track(userId, {
      event_type: 'abuse_signal',
      metadata: { action, target_type: targetType, reason },
    }),

  createLauncher: (userId: string | null, action: string): void =>
    void track(userId, {
      event_type: 'create_launcher',
      metadata: { action },
    }),

  postEdit: (
    userId: string | null,
    postId: string,
    action: string,
    changedFieldCount?: number
  ): void =>
    void track(userId, {
      event_type: 'post_edit',
      entity_type: 'post',
      entity_id: postId,
      metadata: { action, changed_field_count: changedFieldCount },
    }),

  modalAction: (userId: string | null, modalId: string, optionId: string): void =>
    void track(userId, {
      event_type: 'modal_action',
      metadata: { modal_id: modalId, option_id: optionId },
    }),

  postShare: (userId: string | null, postId: string, shareTarget: string): void =>
    void track(userId, {
      event_type: 'post_share',
      entity_type: 'post',
      entity_id: postId,
      metadata: { share_target: shareTarget },
    }),

  actionError: (userId: string | null, action: string, errorClass: string): void =>
    void track(userId, {
      event_type: 'action_error',
      metadata: { action, error_class: errorClass },
    }),

  providerUsage: (
    userId: string | null,
    provider: string,
    requestType: string,
    feature: string,
    cacheStatus: ProviderCacheState,
    fallbackReason?: string,
    costClass?: string
  ): void => {
    const eventTypeByStatus: Record<ProviderCacheState, string> = {
      hit: 'provider_cache_hit',
      miss: 'provider_cache_miss',
      deduped: 'provider_request_deduped',
      blocked: 'provider_request_blocked',
      error: 'provider_request_error',
    }
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
    })
  },
}
