import type { SearchResultType, SearchSuggestionType } from '@/lib/search/filterContracts'
import { supabase } from '@/lib/supabase'
import type { AuthProvider, OAuthProvider } from '@/lib/utils/authProviders'
import { track, searchAttributionMetadata } from './core'
import type { SearchAttribution, PlaceSelectionSource, ProviderCacheState } from './core'

export type AuthFailureReason =
  | 'cancelled'
  | 'missing_token'
  | 'network'
  | 'provider_error'
  | 'session_error'
  | 'unknown'

// Bounded enum for reconnect failures — never use raw error strings (cardinality protection).
// DO NOT add: OAuth tokens, identity payloads, full error messages, or user emails to these events.
export type ReconnectFailureReason = 'cancelled' | 'oauth_failure' | 'network' | 'unknown'

export const analytics = {
  // Post events
  viewPost: (
    userId: string | null,
    postId: string,
    cuisineType?: string | null,
    attribution?: SearchAttribution | null
  ): void =>
    void track(userId, {
      event_type: 'post_view',
      entity_type: 'post',
      entity_id: postId,
      metadata: { cuisine_type: cuisineType, ...searchAttributionMetadata(attribution) },
    }),

  likePost: (userId: string, postId: string): void =>
    void track(userId, { event_type: 'post_like', entity_type: 'post', entity_id: postId }),

  savePost: (
    userId: string,
    postId: string,
    cuisineType?: string | null,
    attribution?: SearchAttribution | null
  ): void =>
    void track(userId, {
      event_type: 'post_save',
      entity_type: 'post',
      entity_id: postId,
      metadata: { cuisine_type: cuisineType, ...searchAttributionMetadata(attribution) },
    }),

  viewDish: (
    userId: string | null,
    dishId: string,
    attribution?: SearchAttribution | null
  ): void =>
    void track(userId, {
      event_type: 'dish_view',
      entity_type: 'dish',
      entity_id: dishId,
      metadata: searchAttributionMetadata(attribution),
    }),

  saveDish: (userId: string, dishId: string, attribution?: SearchAttribution | null): void =>
    void track(userId, {
      event_type: 'dish_save',
      entity_type: 'dish',
      entity_id: dishId,
      metadata: searchAttributionMetadata(attribution),
    }),

  // Privacy: only userId, mutationKind (enum), and outcome are permitted.
  // Banned: message body, post captions, profile values, media URLs, collection names, report/moderation content.
  offlineMutation: (userId: string, mutationKind: string, outcome: 'queued' | 'synced' | 'sync_failed'): void =>
    void track(userId, {
      event_type: 'offline_mutation_sync',
      metadata: { mutation_kind: mutationKind, outcome },
    }),

  followRequestStateChanged: (
    userId: string | null,
    action:
      | 'sent'
      | 'approved'
      | 'declined'
      | 'approved_immediate'
      | 'approved_bulk'
      | 'declined_bulk'
      | 'approved_auto_public'
  ): void =>
    void track(userId, {
      event_type: 'follow_request_state_changed',
      metadata: { action },
    }),

  privacySettingChanged: (
    userId: string | null,
    setting: 'private_account' | 'show_activity_status',
    enabled: boolean
  ): void =>
    void track(userId, {
      event_type: 'privacy_setting_changed',
      metadata: { setting, enabled },
    }),

  notificationSettingChanged: (
    userId: string | null,
    setting: 'notif_likes' | 'notif_comments' | 'notif_followers' | 'notif_mentions' | 'notif_messages',
    enabled: boolean
  ): void =>
    void track(userId, {
      event_type: 'notification_setting_changed',
      metadata: { setting, enabled },
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
  viewPlace: (
    userId: string | null,
    placeId: string,
    query?: string,
    cuisineType?: string | null,
    attribution?: SearchAttribution | null
  ): void =>
    void track(userId, {
      event_type: 'place_view',
      entity_type: 'place',
      entity_id: placeId,
      metadata: { query, cuisine_type: cuisineType, ...searchAttributionMetadata(attribution) },
    }),

  clickPlace: (userId: string | null, placeId: string): void =>
    void track(userId, {
      event_type: 'place_click',
      entity_type: 'place',
      entity_id: placeId,
    }),

  savePlace: (
    userId: string,
    placeId: string,
    cuisineType?: string | null,
    attribution?: SearchAttribution | null
  ): void =>
    void track(userId, {
      event_type: 'place_save',
      entity_type: 'place',
      entity_id: placeId,
      metadata: { cuisine_type: cuisineType, ...searchAttributionMetadata(attribution) },
    }),

  revisitPlace: (userId: string | null, placeId: string, source: string): void =>
    void track(userId, {
      event_type: 'place_revisit',
      entity_type: 'place',
      entity_id: placeId,
      metadata: { source },
    }),

  placeSearchTermEntered: (userId: string | null, query: string): void =>
    void track(userId, {
      event_type: 'search_term_entered',
      metadata: { query },
    }),

  placeSearchZeroResults: (userId: string | null, query: string): void =>
    void track(userId, {
      event_type: 'place_search_zero_results',
      metadata: { query },
    }),

  placeSelected: (
    userId: string | null,
    googlePlaceId: string,
    source: PlaceSelectionSource,
    placeId?: string | null,
    cuisineType?: string | null
  ): void =>
    void track(userId, {
      event_type: 'place_selected',
      entity_type: 'place',
      ...(placeId ? { entity_id: placeId } : {}),
      metadata: {
        place_id: googlePlaceId,
        source,
        restaurant_id: placeId,
        cuisine_type: cuisineType,
      },
    }),

  placeFieldSkipped: (userId: string | null): void =>
    void track(userId, {
      event_type: 'place_field_skipped',
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
    resultType: 'post' | 'place' | 'user' | 'dish' | 'collection' | 'person',
    entityId: string,
    query: string,
    position: number,
    searchSessionId: string
  ): void =>
    void track(userId, {
      event_type: 'search_result_click',
      entity_type: resultType === 'person' ? 'user' : resultType,
      entity_id: entityId,
      metadata: {
        query,
        result_type: resultType,
        result_position: position,
        search_session_id: searchSessionId,
      },
    }),

  searchFilterSheetOpened: (userId: string | null, filterCount: number): void =>
    void track(userId, {
      event_type: 'search_filter_sheet_opened',
      metadata: { filter_count: Math.max(0, Math.round(filterCount)) },
    }),

  searchSuggestionSelected: (
    userId: string | null,
    suggestionType: SearchSuggestionType,
    suggestionId: string,
    suggestionSlug: string,
    position: number
  ): void =>
    void track(userId, {
      event_type: 'search_suggestion_selected',
      metadata: {
        suggestion_type: suggestionType,
        suggestion_id: suggestionId,
        suggestion_slug: suggestionSlug,
        position: Math.max(1, Math.round(position)),
      },
    }),

  searchNoResults: (
    userId: string | null,
    query: string,
    resultType?: SearchResultType | null,
    rankingVersion?: string | null
  ): void =>
    void track(userId, {
      event_type: 'search_no_results',
      metadata: {
        query,
        ...(resultType ? { result_type: resultType } : {}),
        ...(rankingVersion ? { ranking_version: rankingVersion } : {}),
      },
    }),

  searchSessionEnd: (
    userId: string | null,
    searchSessionId: string,
    sessionDurationMs: number,
    hadResults: boolean,
    resultClicked: boolean,
    query: string | null
  ): void =>
    void track(userId, {
      event_type: 'search_session_end',
      metadata: {
        search_session_id: searchSessionId,
        session_duration_ms: Math.max(0, Math.round(sessionDurationMs)),
        had_results: hadResults,
        result_clicked: resultClicked,
        ...(query ? { query } : {}),
      },
    }),

  searchAbandon: (
    userId: string | null,
    query: string,
    resultCount: number,
    sessionDurationMs: number,
    searchSessionId: string
  ): void =>
    void track(userId, {
      event_type: 'search_abandon',
      metadata: {
        query,
        result_count: resultCount,
        session_duration_ms: Math.max(0, Math.round(sessionDurationMs)),
        search_session_id: searchSessionId,
      },
    }),

  noResultsShown: (userId: string | null, failedQuery: string, suggestions: string[]): void =>
    void track(userId, {
      event_type: 'no_results_shown',
      metadata: {
        query: failedQuery,
        suggestion_queries: suggestions.map(s => s.trim()).filter(Boolean).slice(0, 5).join('|'),
      },
    }),

  noResultsSuggestionClick: (
    userId: string | null,
    failedQuery: string,
    selectedQuery: string,
    position: number
  ): void =>
    void track(userId, {
      event_type: 'no_results_suggestion_click',
      metadata: {
        query: failedQuery,
        selected_query: selectedQuery,
        position: Math.max(1, Math.round(position)),
      },
    }),

  saveSearch: (userId: string | null, query: string): void =>
    void track(userId, {
      event_type: 'search_saved',
      metadata: { query },
    }),

  unsaveSearch: (userId: string | null, query: string): void =>
    void track(userId, {
      event_type: 'search_unsaved',
      metadata: { query },
    }),

  savedSearchSelected: (userId: string | null, query: string): void =>
    void track(userId, {
      event_type: 'saved_search_selected',
      metadata: { query },
    }),

  searchSavedSearchUsed: (
    userId: string | null,
    query: string,
    searchSessionId?: string | null
  ): void =>
    void track(userId, {
      event_type: 'search_saved_search_used',
      metadata: {
        query,
        ...(searchSessionId ? { search_session_id: searchSessionId } : {}),
      },
    }),

  searchLocationNudgeShown: (
    userId: string | null,
    queryIntent: string,
    locationSource: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_location_nudge_shown',
      metadata: {
        query_intent: queryIntent,
        has_location_context: false,
        location_source: locationSource,
        search_mode: searchMode,
      },
    }),

  searchLocationNudgeClicked: (
    userId: string | null,
    queryIntent: string,
    locationSource: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_location_nudge_clicked',
      metadata: {
        query_intent: queryIntent,
        has_location_context: false,
        location_source: locationSource,
        search_mode: searchMode,
      },
    }),

  searchLocationPermissionResult: (
    userId: string | null,
    status: string,
    queryIntent: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_location_permission_result',
      metadata: {
        status,
        query_intent: queryIntent,
        search_mode: searchMode,
      },
    }),

  searchGoogleFallbackUsed: (
    userId: string | null,
    query: string,
    queryIntent: string,
    fallbackReason: string,
    hasLocationContext: boolean,
    locationSource: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_google_fallback_used',
      metadata: {
        query,
        query_intent: queryIntent,
        fallback_reason: fallbackReason,
        has_location_context: hasLocationContext,
        location_source: locationSource,
        search_mode: searchMode,
      },
    }),

  searchGoogleFallbackSuppressed: (
    userId: string | null,
    query: string,
    queryIntent: string,
    fallbackReason: string,
    locationSource: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_google_fallback_suppressed',
      metadata: {
        query,
        query_intent: queryIntent,
        fallback_reason: fallbackReason,
        has_location_context: false,
        location_source: locationSource,
        search_mode: searchMode,
      },
    }),

  searchNoResultsAfterSuppression: (
    userId: string | null,
    query: string,
    queryIntent: string,
    fallbackReason: string,
    searchMode: string
  ): void =>
    void track(userId, {
      event_type: 'search_no_results_after_suppression',
      metadata: {
        query,
        query_intent: queryIntent,
        fallback_reason: fallbackReason,
        has_location_context: false,
        location_source: 'none',
        search_mode: searchMode,
      },
    }),

  placeTaggingGoogleFallbackUsed: (
    userId: string | null,
    query: string,
    queryIntent: string,
    fallbackReason: string,
    hasLocationContext: boolean,
    locationSource: string
  ): void =>
    void track(userId, {
      event_type: 'restaurant_tagging_google_fallback_used',
      metadata: {
        query,
        query_intent: queryIntent,
        fallback_reason: fallbackReason,
        has_location_context: hasLocationContext,
        location_source: locationSource,
      },
    }),

  placeTaggingGoogleFallbackSuppressed: (
    userId: string | null,
    query: string,
    queryIntent: string,
    fallbackReason: string,
    locationSource: string
  ): void =>
    void track(userId, {
      event_type: 'restaurant_tagging_google_fallback_suppressed',
      metadata: {
        query,
        query_intent: queryIntent,
        fallback_reason: fallbackReason,
        has_location_context: false,
        location_source: locationSource,
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

  profileFollowListOpened: (
    userId: string | null,
    targetUserId: string,
    listType: 'followers' | 'following'
  ): void =>
    void track(userId, {
      event_type: 'profile_follow_list_opened',
      entity_type: 'user',
      entity_id: targetUserId,
      metadata: { list_type: listType },
    }),

  profileInteraction: (
    userId: string | null,
    targetUserId: string | null,
    action: string,
    metadata?: Record<string, unknown>
  ): void =>
    void track(userId, {
      event_type: 'profile_interaction',
      ...(targetUserId ? { entity_type: 'user' as const, entity_id: targetUserId } : {}),
      metadata: { action, ...metadata },
    }),

  screen: (userId: string | null, screenName: string): void =>
    void track(userId, { event_type: 'screen_view', metadata: { screen: screenName } }),

  blockedAccountsScreenViewed: (userId: string | null): void =>
    void track(userId, { event_type: 'blocked_accounts_screen_viewed' }),

  blockedAccountsSearchUsed: (userId: string | null): void =>
    void track(userId, { event_type: 'blocked_accounts_search_used' }),

  onboardingStep: (userId: string | null, step: string, outcome: string, reason?: string): void =>
    void track(userId, { event_type: 'onboarding_step', metadata: { step, outcome, reason } }),

  onboardingAnomaly: (userId: string | null, step: string, reason: string): void =>
    void track(userId, { event_type: 'onboarding_anomaly', metadata: { step, reason } }),

  loginOAuthStarted: (userId: string | null, provider: OAuthProvider): void =>
    void track(userId, { event_type: 'login_oauth_started', metadata: { provider } }),

  loginOAuthSuccess: (userId: string | null, provider: OAuthProvider): void =>
    void track(userId, { event_type: 'login_oauth_success', metadata: { provider } }),

  loginOAuthFailed: (userId: string | null, provider: OAuthProvider, reason: AuthFailureReason): void =>
    void track(userId, { event_type: 'login_oauth_failed', metadata: { provider, reason } }),

  accountLinked: (userId: string | null, provider: AuthProvider): void =>
    void track(userId, { event_type: 'account_linked', metadata: { provider } }),

  accountUnlinked: (userId: string | null, provider: AuthProvider): void =>
    void track(userId, { event_type: 'account_unlinked', metadata: { provider } }),

  // Fires only on connected → revoked transition; never on revoked → revoked (transition-based, not state-based).
  providerRevoked: (userId: string | null, provider: OAuthProvider): void =>
    void track(userId, { event_type: 'provider_revoked_detected', metadata: { provider } }),

  providerReconnected: (userId: string | null, provider: OAuthProvider): void =>
    void track(userId, { event_type: 'provider_reconnected', metadata: { provider } }),

  providerReconnectFailed: (userId: string | null, provider: OAuthProvider, reason: ReconnectFailureReason): void =>
    void track(userId, { event_type: 'provider_reconnect_failed', metadata: { provider, reason } }),

  dishTagOnboardingShown: (userId: string | null): void =>
    void track(userId, { event_type: 'dish_tag_onboarding_shown', entity_type: 'dish' }),

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

  // Funnel events for multi-step user flows.
  // outcome: 'viewed' on step entry, 'completed' on advance, 'abandoned' on back/discard.
  createPostFunnel: (
    userId: string | null,
    step: number,
    outcome: 'viewed' | 'completed' | 'abandoned',
    metadata?: { duration_ms?: number; reason?: string; session_duration_ms?: number }
  ): void =>
    void track(userId, {
      event_type: 'create_post_funnel',
      metadata: { step, outcome, ...metadata },
    }),

  // Rapid repeated taps on the same element within 1 s (≥3 = rage proxy).
  // Sampled at 0.5 — high-volume diagnostic, not a conversion event.
  rageTap: (
    userId: string | null,
    surface: string,
    action: string,
    step: number,
    tapCount: number
  ): void =>
    void track(userId, {
      event_type: 'interaction_rage_tap',
      sampleRate: 0.5,
      metadata: { surface, action, step, tap_count: tapCount },
    }),

  // Tap on a visually active but currently disabled interactive element.
  // Sampled at 0.5.
  deadClick: (userId: string | null, surface: string, action: string, step: number): void =>
    void track(userId, {
      event_type: 'interaction_dead_click',
      sampleRate: 0.5,
      metadata: { surface, action, step },
    }),

  // Privacy rule: conversation_id is the only permitted linking key.
  // Never include message body, sender identity, or recipient identity.
  messageEvent: (
    userId: string | null,
    eventType: string,
    metadata?: { conversationId?: string; messageType?: string; hasAttachment?: boolean; isGroup?: boolean }
  ): void =>
    void track(userId, {
      event_type: eventType,
      metadata: {
        ...(metadata?.conversationId ? { conversation_id: metadata.conversationId } : {}),
        ...(metadata?.messageType ? { message_type: metadata.messageType } : {}),
        ...(metadata?.hasAttachment !== undefined ? { has_attachment: metadata.hasAttachment } : {}),
        ...(metadata?.isGroup !== undefined ? { is_group: metadata.isGroup } : {}),
      },
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
      entity_type: 'place',
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

  viewClosureBanner: (
    userId: string | null,
    placeId: string,
    status: string,
    source: string | null,
    provider?: string | null,
    signalAgeDays?: number | null,
  ): void =>
    void track(userId, {
      event_type: 'place_closure_banner_impression',
      entity_type: 'place',
      entity_id: placeId,
      metadata: {
        closure_status: status,
        closure_source: source,
        provider: provider ?? null,
        signal_age_days: signalAgeDays ?? null,
      },
    }),

  // Taxonomy events (B-625)
  // Privacy: source is an enum value; confidence is a float. No free-form strings.
  taxonomySuggestionCreated: (
    userId: string | null,
    source: 'osm' | 'user' | 'admin' | 'ai',
    confidence: number
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_suggestion_created',
      metadata: { source, confidence },
    }),

  taxonomySuggestionPromoted: (
    userId: string | null,
    source: 'osm' | 'user' | 'admin' | 'ai',
    promotedAutomatically: boolean
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_suggestion_promoted',
      metadata: { source, promoted_automatically: promotedAutomatically },
    }),

  taxonomySuggestionRejected: (
    userId: string | null,
    source: 'osm' | 'user' | 'admin' | 'ai',
    reviewReason: string | null
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_suggestion_rejected',
      metadata: { source, review_reason: reviewReason },
    }),

  taxonomyAssignmentCreated: (
    userId: string | null,
    source: 'osm' | 'user' | 'admin' | 'ai',
    confidence: number
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_assignment_created',
      metadata: { source, confidence },
    }),

  taxonomyReviewCompleted: (
    userId: string | null,
    action: 'approve' | 'reject',
    queueAgeHours: number
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_review_completed',
      metadata: { action, queue_age_hours: Math.round(queueAgeHours) },
    }),

  taxonomyAssignmentRemoved: (
    userId: string | null,
    source: 'osm' | 'user' | 'admin' | 'ai'
  ): void =>
    void track(userId, {
      event_type: 'taxonomy_assignment_removed',
      metadata: { source },
    }),

  // MFA events
  // Privacy invariant: never include OTP values, recovery codes, TOTP secrets, or QR SVG payloads.
  // Only event names, timestamps, and non-sensitive metadata (factor_id, attempt_number).
  twoFactorSetupStarted: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_setup_started' }),

  twoFactorSetupQrShown: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_setup_qr_shown' }),

  twoFactorSetupVerificationFailed: (userId: string | null, attemptNumber: number): void =>
    void track(userId, {
      event_type: 'two_factor_setup_verification_failed',
      metadata: { attempt_number: attemptNumber },
    }),

  twoFactorSetupCompleted: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_setup_completed' }),

  twoFactorSetupAbandoned: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_setup_abandoned' }),

  twoFactorRemoved: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_removed' }),

  twoFactorDisableStarted: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_disable_started' }),

  twoFactorDisableCancelled: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_disable_cancelled' }),

  twoFactorChallengePresented: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_challenge_presented' }),

  twoFactorChallengeSucceeded: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_challenge_succeeded' }),

  twoFactorChallengeFailed: (userId: string | null, attemptNumber: number): void =>
    void track(userId, {
      event_type: 'two_factor_challenge_failed',
      metadata: { attempt_number: attemptNumber },
    }),

  twoFactorRecoveryCodeUsed: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_recovery_code_used' }),

  twoFactorRecoveryCodeFailed: (userId: string | null, attemptNumber: number): void =>
    void track(userId, {
      event_type: 'two_factor_recovery_code_failed',
      metadata: { attempt_number: attemptNumber },
    }),

  twoFactorRecoveryCodesRegenerated: (userId: string | null): void =>
    void track(userId, { event_type: 'two_factor_recovery_codes_regenerated' }),
}
