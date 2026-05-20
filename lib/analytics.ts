import { supabase } from '@/lib/supabase'
import { isCoolingDown } from '@/lib/utils/cooldown'

type EntityType = 'restaurant' | 'post' | 'user' | 'collection'

type EventPayload = {
  event_type: string
  entity_type?: EntityType
  entity_id?: string
  metadata?: Record<string, unknown>
}

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
    const metadata = sanitizeAnalyticsMetadata(payload.metadata)
    const identity = userId ?? 'anonymous'
    const entity = payload.entity_id ?? JSON.stringify(metadata ?? {})
    if (isCoolingDown(`analytics:${identity}:${payload.event_type}:${entity}`, 15_000)) return
    await (supabase.from('analytics_events') as any).insert({
      user_id: userId,
      ...payload,
      metadata,
    })
  } catch {
    // analytics must never crash the app
  }
}

export const analytics = {
  // Post events
  viewPost: (userId: string | null, postId: string) =>
    track(userId, { event_type: 'post_view', entity_type: 'post', entity_id: postId }),

  likePost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_like', entity_type: 'post', entity_id: postId }),

  savePost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_save', entity_type: 'post', entity_id: postId }),

  dwellPost: (userId: string | null, postId: string, durationMs: number) =>
    track(userId, {
      event_type: 'post_dwell',
      entity_type: 'post',
      entity_id: postId,
      metadata: { duration_ms: Math.max(0, Math.round(durationMs)) },
    }),

  commentPost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_comment', entity_type: 'post', entity_id: postId }),

  // Place events
  viewPlace: (userId: string | null, restaurantId: string, query?: string) =>
    track(userId, {
      event_type: 'place_view',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      metadata: { query },
    }),

  clickPlace: (userId: string | null, restaurantId: string) =>
    track(userId, {
      event_type: 'place_click',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    }),

  savePlace: (userId: string, restaurantId: string) =>
    track(userId, { event_type: 'place_save', entity_type: 'restaurant', entity_id: restaurantId }),

  revisitPlace: (userId: string | null, restaurantId: string, source: string) =>
    track(userId, {
      event_type: 'restaurant_revisit',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      metadata: { source },
    }),

  // Search events
  search: (userId: string | null, query: string, resultCount: number) =>
    track(userId, { event_type: 'search', metadata: { query, result_count: resultCount } }),

  searchQuery: (
    userId: string | null,
    query: string,
    resultCount: number,
    searchSessionId: string,
    queryPosition: number,
    metadata?: Record<string, unknown>
  ) =>
    track(userId, {
      event_type: 'search_query',
      metadata: {
        query,
        result_count: resultCount,
        search_session_id: searchSessionId,
        query_position: queryPosition,
        ...metadata,
      },
    }),

  dismissSearchQuery: async (userId: string, query: string) => {
    try {
      await (supabase.from('analytics_events') as any)
        .delete()
        .eq('user_id', userId)
        .eq('event_type', 'search_query')
        .filter('metadata->>query', 'ilike', query)
    } catch {
      // analytics history cleanup must never crash the app
    }
  },

  searchResultClick: (
    userId: string | null,
    resultType: 'post' | 'restaurant' | 'user',
    entityId: string,
    query: string,
    position: number,
    searchSessionId: string
  ) =>
    track(userId, {
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
  ) =>
    track(userId, {
      event_type: 'feed_diagnostic',
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
  ) =>
    track(userId, {
      event_type: 'collection_interaction',
      entity_type: collectionId ? 'collection' : undefined,
      entity_id: collectionId,
      metadata: { action, collection_id: collectionId, ...metadata },
    }),

  // User events
  follow: (userId: string, targetUserId: string) =>
    track(userId, { event_type: 'user_follow', entity_type: 'user', entity_id: targetUserId }),

  screen: (userId: string | null, screenName: string) =>
    track(userId, { event_type: 'screen_view', metadata: { screen: screenName } }),

  onboardingStep: (userId: string | null, step: string, outcome: string, reason?: string) =>
    track(userId, { event_type: 'onboarding_step', metadata: { step, outcome, reason } }),

  onboardingAnomaly: (userId: string | null, step: string, reason: string) =>
    track(userId, { event_type: 'onboarding_anomaly', metadata: { step, reason } }),

  uploadFailure: (userId: string | null, surface: string, reason: string, rejectedCount?: number) =>
    track(userId, {
      event_type: 'upload_failure',
      metadata: { surface, reason, rejected_count: rejectedCount },
    }),

  mediaEvent: (
    userId: string | null,
    eventType: string,
    surface: string,
    metadata?: Record<string, unknown>
  ) =>
    track(userId, {
      event_type: eventType,
      metadata: { surface, ...metadata },
    }),

  searchFilter: (userId: string | null, action: 'applied' | 'removed', filterType: string, filterId?: string) =>
    track(userId, {
      event_type: action === 'applied' ? 'search_filter_applied' : 'search_filter_removed',
      metadata: { filter_type: filterType, filter_id: filterId },
    }),

  rekkusPickSelected: (userId: string | null, filterType: string, filterId: string) =>
    track(userId, {
      event_type: 'rekkus_pick_selected',
      metadata: { filter_type: filterType, filter_id: filterId },
    }),

  abuseSignal: (userId: string | null, action: string, targetType: string, reason: string) =>
    track(userId, {
      event_type: 'abuse_signal',
      metadata: { action, target_type: targetType, reason },
    }),

  createLauncher: (userId: string | null, action: string) =>
    track(userId, {
      event_type: 'create_launcher',
      metadata: { action },
    }),

  postEdit: (
    userId: string | null,
    postId: string,
    action: string,
    changedFieldCount?: number
  ) =>
    track(userId, {
      event_type: 'post_edit',
      entity_type: 'post',
      entity_id: postId,
      metadata: { action, changed_field_count: changedFieldCount },
    }),

  modalAction: (userId: string | null, modalId: string, optionId: string) =>
    track(userId, {
      event_type: 'modal_action',
      metadata: { modal_id: modalId, option_id: optionId },
    }),

  postShare: (userId: string | null, postId: string, shareTarget: string) =>
    track(userId, {
      event_type: 'post_share',
      entity_type: 'post',
      entity_id: postId,
      metadata: { share_target: shareTarget },
    }),

  actionError: (userId: string | null, action: string, errorClass: string) =>
    track(userId, {
      event_type: 'action_error',
      metadata: { action, error_class: errorClass },
    }),
}
