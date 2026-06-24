const SAFE_METADATA_KEYS = new Set([
  'query',
  'result_count',
  'rejected_count',
  'selected_query',
  'suggestion_queries',
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
  'query_intent',
  'has_location_context',
  'location_source',
  'status',
  'topic',
  'collection_id',
  'collection_visibility',
  'filter_type',
  'filter_id',
  'filter_slug',
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
  'profile_tab',
  'map_action',
  'request_state',
  'field_count',
  'request_type',
  'feature',
  'cache_status',
  'mutation_kind',
  'near_city',
  'list_type',
  'tap_count',
  'session_duration_ms',
  'had_results',
  'result_clicked',
  'ranking_version',
  'suggestion_type',
  'suggestion_id',
  'suggestion_slug',
  'search_view_state',
  'conversation_id',
  'message_type',
  'has_attachment',
  'is_group',
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
