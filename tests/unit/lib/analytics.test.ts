import { analytics, sanitizeAnalyticsMetadata } from '@/lib/analytics'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

jest.mock('@/lib/utils/cooldown', () => ({
  isCoolingDown: jest.fn().mockReturnValue(false),
}))

const mockFrom = jest.mocked(supabase.from)
const mockInsert = jest.fn().mockResolvedValue({ error: null })

async function flushAnalytics(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function lastInsertedRow(): Record<string, unknown> {
  return mockInsert.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

describe('analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert } as never)
  })

  it('sanitizes unsafe and non-allowlisted metadata', () => {
    expect(sanitizeAnalyticsMetadata({
      query: 'ramen',
      selected_query: 'password reset token',
      precise_location: '-33.8688,151.2093',
      raw_provider_payload: '{"name":"secret place"}',
      ignored: 'not allowed',
      suggestion_queries: ['ramen'],
    })).toEqual({
      query: 'ramen',
      selected_query: '[redacted]',
    })
  })

  it('emits search attribution metadata on downstream view and save events', async () => {
    const attribution = {
      searchSessionId: 'search-session-1',
      query: 'ramen',
      resultType: 'post' as const,
      resultPosition: 2,
    }

    analytics.viewPost('user-1', 'post-1', 'Japanese', attribution)
    analytics.savePost('user-1', 'post-1', 'Japanese', attribution)
    analytics.viewPlace('user-1', 'restaurant-1', undefined, 'Japanese', attribution)
    analytics.savePlace('user-1', 'restaurant-1', 'Japanese', attribution)
    analytics.viewDish('user-1', 'dish-1', attribution)
    analytics.saveDish('user-1', 'dish-1', attribution)
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({
        event_type: 'post_view',
        metadata: {
          cuisine_type: 'Japanese',
          query: 'ramen',
          search_session_id: 'search-session-1',
          result_type: 'post',
          result_position: 2,
        },
      }),
      expect.objectContaining({
        event_type: 'post_save',
        metadata: expect.objectContaining({ search_session_id: 'search-session-1' }),
      }),
      expect.objectContaining({
        event_type: 'place_view',
        metadata: expect.objectContaining({ search_session_id: 'search-session-1' }),
      }),
      expect.objectContaining({
        event_type: 'place_save',
        metadata: expect.objectContaining({ search_session_id: 'search-session-1' }),
      }),
      expect.objectContaining({
        event_type: 'dish_view',
        metadata: expect.objectContaining({ search_session_id: 'search-session-1' }),
      }),
      expect.objectContaining({
        event_type: 'dish_save',
        metadata: expect.objectContaining({ search_session_id: 'search-session-1' }),
      }),
    ])
  })

  it('does not allow raw result payloads or precise location through metadata sanitization', () => {
    expect(sanitizeAnalyticsMetadata({
      query: 'ramen',
      search_session_id: 'search-session-1',
      result_type: 'restaurant',
      result_position: 1,
      precise_location: '-33.8688,151.2093',
      raw_provider_payload: '{"place_id":"secret"}',
      result_name: 'Ramen Bar',
    })).toEqual({
      query: 'ramen',
      search_session_id: 'search-session-1',
      result_type: 'restaurant',
      result_position: 1,
    })
  })

  it('emits no-results shown with compact suggestion metadata', async () => {
    analytics.noResultsShown('user-1', 'xyzzy', ['ramen', 'dumplings'])
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'no_results_shown',
      event_version: 1,
      metadata: {
        query: 'xyzzy',
        suggestion_queries: 'ramen|dumplings',
      },
    })
  })

  it('emits no-results suggestion clicks with selected query and position', async () => {
    analytics.noResultsSuggestionClick(null, 'xyzzy', 'ramen', 2)
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: null,
      event_type: 'no_results_suggestion_click',
      event_version: 1,
      metadata: {
        query: 'xyzzy',
        selected_query: 'ramen',
        position: 2,
      },
    })
  })

  it('emits saved search analytics', async () => {
    analytics.saveSearch('user-1', 'omakase CBD')
    analytics.unsaveSearch('user-1', 'omakase CBD')
    analytics.savedSearchSelected('user-1', 'omakase CBD')
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({
        event_type: 'search_saved',
        metadata: { query: 'omakase CBD' },
      }),
      expect.objectContaining({
        event_type: 'search_unsaved',
        metadata: { query: 'omakase CBD' },
      }),
      expect.objectContaining({
        event_type: 'saved_search_selected',
        metadata: { query: 'omakase CBD' },
      }),
    ])
  })

  it('emits profile follow list analytics with safe list type metadata', async () => {
    analytics.profileFollowListOpened('viewer-1', 'target-1', 'followers')
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'viewer-1',
      event_type: 'profile_follow_list_opened',
      event_version: 1,
      entity_type: 'user',
      entity_id: 'target-1',
      metadata: { list_type: 'followers' },
    })
  })

  it('emits create-post restaurant search term analytics', async () => {
    analytics.restaurantSearchTermEntered('user-1', 'ramen')
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'search_term_entered',
      event_version: 1,
      metadata: { query: 'ramen' },
    })
  })

  it('emits create-post restaurant zero-results analytics', async () => {
    analytics.restaurantSearchZeroResults('user-1', 'xyzzy')
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'restaurant_search_zero_results',
      event_version: 1,
      metadata: { query: 'xyzzy' },
    })
  })

  it('emits search fallback analytics without precise location metadata', async () => {
    analytics.searchGoogleFallbackSuppressed(
      'user-1',
      'pork',
      'food_dish',
      'ambiguous_food_without_location',
      'none',
      'search'
    )
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'search_google_fallback_suppressed',
      event_version: 1,
      metadata: {
        query: 'pork',
        query_intent: 'food_dish',
        fallback_reason: 'ambiguous_food_without_location',
        has_location_context: false,
        location_source: 'none',
        search_mode: 'search',
      },
    })
  })

  it('emits selected restaurant analytics with source metadata', async () => {
    analytics.restaurantSelected('user-1', 'place-1', 'nearby', 'restaurant-1', 'Japanese')
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'restaurant_selected',
      event_version: 1,
      entity_type: 'restaurant',
      entity_id: 'restaurant-1',
      metadata: {
        place_id: 'place-1',
        source: 'nearby',
        restaurant_id: 'restaurant-1',
        cuisine_type: 'Japanese',
      },
    })
  })

  it('emits restaurant field skipped without search metadata', async () => {
    analytics.restaurantFieldSkipped('user-1')
    await flushAnalytics()

    expect(lastInsertedRow()).toMatchObject({
      user_id: 'user-1',
      event_type: 'restaurant_field_skipped',
      event_version: 1,
    })
    expect(lastInsertedRow()).not.toHaveProperty('metadata')
  })

  it('includes cuisine metadata on engagement events when provided', async () => {
    analytics.viewPost('user-1', 'post-1', 'Japanese')
    analytics.savePost('user-1', 'post-1', 'Japanese')
    analytics.viewPlace('user-1', 'restaurant-1', undefined, 'Japanese')
    analytics.savePlace('user-1', 'restaurant-1', 'Japanese')
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.objectContaining({ event_type: 'post_view', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'post_save', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'place_view', metadata: { cuisine_type: 'Japanese' } }),
      expect.objectContaining({ event_type: 'place_save', metadata: { cuisine_type: 'Japanese' } }),
    ])
  })

  it('omits cuisine metadata on engagement events when absent', async () => {
    analytics.viewPost('user-1', 'post-1')
    analytics.savePost('user-1', 'post-1')
    analytics.viewPlace('user-1', 'restaurant-1')
    analytics.savePlace('user-1', 'restaurant-1')
    await flushAnalytics()

    expect(mockInsert.mock.calls.map(call => call[0])).toEqual([
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
      expect.not.objectContaining({ metadata: expect.anything() }),
    ])
  })
})
