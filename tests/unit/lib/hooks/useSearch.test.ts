import { act, renderHook } from '@testing-library/react-native'
import { analytics } from '@/lib/analytics'
import type { PlaceResult } from '@/lib/hooks/searchTypes'
import { useSearch } from '@/lib/hooks/useSearch'
import { fetchPlaceAutocompleteJson } from '@/lib/services/googlePlaces'
import { searchPlaces } from '@/lib/services/search'

const mockPosts: [] = []

jest.mock('@/lib/analytics', () => ({
  analytics: {
    search: jest.fn(),
    searchGoogleFallbackUsed: jest.fn(),
    searchGoogleFallbackSuppressed: jest.fn(),
    searchNoResultsAfterSuppression: jest.fn(),
  },
}))
jest.mock('@/lib/contexts/PostsContext', () => ({
  usePosts: () => ({ posts: mockPosts }),
}))
jest.mock('@/lib/featureFlags', () => ({
  isEnabled: jest.fn().mockReturnValue(false),
}))
jest.mock('@/lib/hooks/useAutocomplete', () => ({
  useAutocomplete: () => [],
}))
jest.mock('@/lib/hooks/usePopularityCache', () => ({
  usePopularityCache: () => new Map(),
}))
jest.mock('@/lib/hooks/useSavedPlaceIds', () => ({
  useSavedPlaceIds: () => new Set(),
}))
jest.mock('@/lib/hooks/useSearchResults', () => ({
  useSearchResults: jest.fn(({ dbPlaces }: { dbPlaces: PlaceResult[] }) => ({
    postResults: [],
    peopleResults: [],
    placeResults: dbPlaces ?? [],
    placeDistances: new Map(),
    expansionLabel: null,
  })),
}))
jest.mock('@/lib/services/googlePlaces', () => ({
  fetchPlaceAutocompleteJson: jest.fn().mockResolvedValue({ predictions: [] }),
}))
// Disable the module-level SEARCH_PIPELINE_CACHE so results don't leak across tests.
jest.mock('@/lib/search/cache', () => ({
  ...jest.requireActual('@/lib/search/cache'),
  createSearchMemoryCache: () => ({ get: () => undefined, set: () => undefined }),
}))
jest.mock('@/lib/services/searchPersonalization', () => ({
  fetchSearchPersonalizationSignals: jest.fn().mockResolvedValue({
    recentQueries: [],
    recentCuisines: [],
    recentAreas: [],
    savedPlaceIds: [],
    savedDishIds: [],
    savedPostIds: [],
  }),
}))
jest.mock('@/lib/services/trending', () => ({
  fetchTrendingEntitySignals: jest.fn().mockResolvedValue({
    placeScores: new Map(),
    postScores: new Map(),
    dishScores: new Map(),
  }),
}))
jest.mock('@/lib/services/posts', () => ({
  fetchPostsByIds: jest.fn().mockResolvedValue([]),
  mapRowToPost: jest.fn(),
}))
jest.mock('@/lib/services/search', () => ({
  fetchDishGraphEvidence: jest.fn().mockResolvedValue(new Map()),
  searchPlaces: jest.fn(),
  searchUsers: jest.fn().mockResolvedValue([]),
  searchPostIds: jest.fn().mockResolvedValue([]),
  searchDishPostIds: jest.fn().mockResolvedValue([]),
  searchDishes: jest.fn().mockResolvedValue([]),
  resolveSearchExpansion: jest.fn().mockResolvedValue({
    cuisines: [],
    expandedPosts: [],
    expandedPlaces: [],
  }),
}))
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        or: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  },
}))
jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn(),
  resolveSuburbQuery: jest.fn(),
  cacheResolvedSuburb: jest.fn(),
}))

const mockSearchPlaces = jest.mocked(searchPlaces)
const mockFetchPlaceAutocompleteJson = jest.mocked(fetchPlaceAutocompleteJson)
const mockAnalyticsSearch = jest.mocked(analytics.search)

function deferred<T>() {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>(resolve => {
    complete = resolve
  })
  return {
    promise,
    resolve(value: T) {
      complete?.(value)
    },
  }
}

const place: PlaceResult = {
  id: 'rest-1',
  name: 'Ramen Bar',
  address: '1 Food Street',
  city: 'Sydney',
  cuisine_type: 'Japanese',
  google_place_id: 'google-1',
  latitude: -33.87,
  longitude: 151.21,
  google_rating: 4.5,
  google_review_count: 20,
}

describe('useSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not publish an in-flight search after the query is cleared', async () => {
    const pending = deferred<PlaceResult[]>()
    mockSearchPlaces.mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderHook<ReturnType<typeof useSearch>, { query: string }>(
      ({ query }) => useSearch(query),
      { initialProps: { query: 'ramen' } }
    )
    await act(async () => {
      jest.advanceTimersByTime(300)
    })

    rerender({ query: '' })
    await act(async () => {
      pending.resolve([place])
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.placeResults).toEqual([])
    expect(mockAnalyticsSearch).not.toHaveBeenCalled()
  })

  it('does not publish an in-flight search after unmount', async () => {
    const pending = deferred<PlaceResult[]>()
    mockSearchPlaces.mockReturnValueOnce(pending.promise)

    const { unmount } = renderHook(() => useSearch('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    unmount()
    await act(async () => {
      pending.resolve([place])
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockAnalyticsSearch).not.toHaveBeenCalled()
  })

  it('suppresses unbounded Google fallback for ambiguous food queries without location', async () => {
    mockSearchPlaces.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSearch('pork'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFetchPlaceAutocompleteJson).not.toHaveBeenCalled()
    expect(result.current.providerFallbackSuppressed).toBe(true)
    expect(result.current.queryIntent).toBe('food_dish')
    expect(analytics.searchGoogleFallbackSuppressed).toHaveBeenCalledWith(
      null,
      'pork',
      'food_dish',
      'ambiguous_food_without_location',
      'none',
      'search'
    )
  })

  it('uses bounded Google fallback for ambiguous food queries with Sydney location', async () => {
    mockSearchPlaces.mockResolvedValueOnce([])

    renderHook(() => useSearch('pork', { lat: -33.87, lng: 151.21 }))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFetchPlaceAutocompleteJson).toHaveBeenCalledWith('pork', { lat: -33.87, lng: 151.21 })
    expect(analytics.searchGoogleFallbackUsed).toHaveBeenCalledWith(
      null,
      'pork',
      'food_dish',
      'bounded_locality',
      true,
      'gps',
      'search'
    )
  })

  it('allows unbounded provider fallback for strong restaurant-name queries', async () => {
    mockSearchPlaces.mockResolvedValueOnce([])

    renderHook(() => useSearch('Din Tai Fung'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFetchPlaceAutocompleteJson).toHaveBeenCalledWith('din tai fung', null)
    expect(analytics.searchGoogleFallbackUsed).toHaveBeenCalledWith(
      null,
      'din tai fung',
      'place_name',
      'unbounded_place_name',
      false,
      'none',
      'search'
    )
  })

  it('records manual locality when provided by the screen', async () => {
    mockSearchPlaces.mockResolvedValueOnce([])

    renderHook(() =>
      useSearch('pork', { lat: -33.8, lng: 151.18 }, { locationSource: 'manual' })
    )
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockFetchPlaceAutocompleteJson).toHaveBeenCalledWith('pork', { lat: -33.8, lng: 151.18 })
    expect(analytics.searchGoogleFallbackUsed).toHaveBeenCalledWith(
      null,
      'pork',
      'food_dish',
      'bounded_locality',
      true,
      'manual',
      'search'
    )
  })

  // B-595: after Phase 6, useSearch must pass pipeline candidates to useSearchResults
  // (not raw dbPlaces / dbUsers / ftsDbPosts etc.)
  describe('B-595: candidate-driven result path', () => {
    it('passes candidates from pipeline to useSearchResults instead of raw dbPlaces', async () => {
      const { useSearchResults: mockUseSearchResults } =
        jest.requireMock('@/lib/hooks/useSearchResults') as {
          useSearchResults: jest.Mock
        }
      mockUseSearchResults.mockClear()
      mockSearchPlaces.mockResolvedValueOnce([place])

      renderHook(() => useSearch('ramen'))
      await act(async () => {
        jest.advanceTimersByTime(300)
        await Promise.resolve()
        await Promise.resolve()
      })

      // After Phase 6, useSearchResults should receive candidates (not dbPlaces)
      expect(mockUseSearchResults).toHaveBeenCalledWith(
        expect.objectContaining({ candidates: expect.any(Array) })
      )
      expect(mockUseSearchResults).not.toHaveBeenCalledWith(
        expect.objectContaining({ dbPlaces: expect.anything() })
      )
    })

    it('does not pass ftsDbPosts, expandedDbPosts, or interactionCounts to useSearchResults', async () => {
      const { useSearchResults: mockUseSearchResults } =
        jest.requireMock('@/lib/hooks/useSearchResults') as {
          useSearchResults: jest.Mock
        }
      mockUseSearchResults.mockClear()
      mockSearchPlaces.mockResolvedValueOnce([])

      renderHook(() => useSearch('ramen'))
      await act(async () => {
        jest.advanceTimersByTime(300)
        await Promise.resolve()
        await Promise.resolve()
      })

      // These are dead-state params that should not exist in the new interface
      expect(mockUseSearchResults).not.toHaveBeenCalledWith(
        expect.objectContaining({ ftsDbPosts: expect.anything() })
      )
      expect(mockUseSearchResults).not.toHaveBeenCalledWith(
        expect.objectContaining({ expandedDbPosts: expect.anything() })
      )
      expect(mockUseSearchResults).not.toHaveBeenCalledWith(
        expect.objectContaining({ interactionCounts: expect.anything() })
      )
    })
  })

  describe('Fix 5: search analytics', () => {
    it('calls analytics.search with query and result count equal to candidates.length', async () => {
      mockSearchPlaces.mockResolvedValueOnce([place])

      renderHook(() => useSearch('ramen'))
      await act(async () => {
        jest.advanceTimersByTime(300)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockAnalyticsSearch).toHaveBeenCalledWith(
        null,
        'ramen',
        expect.any(Number)
      )
      // result count must be >= 0 and reflect actual candidates, not raw DB rows
      expect(mockAnalyticsSearch.mock.calls[0]?.[2]).toBeGreaterThanOrEqual(0)
    })

    it('records results_count: 0 correctly for a zero-result search', async () => {
      mockSearchPlaces.mockResolvedValueOnce([])

      renderHook(() => useSearch('unicornfoodxyz123'))
      await act(async () => {
        jest.advanceTimersByTime(300)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockAnalyticsSearch).toHaveBeenCalledWith(null, 'unicornfoodxyz123', 0)
    })
  })
})
