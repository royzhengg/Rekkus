import { act, renderHook } from '@testing-library/react-native'
import { analytics } from '@/lib/analytics'
import type { PlaceResult } from '@/lib/hooks/searchTypes'
import { useSearch } from '@/lib/hooks/useSearch'
import { searchPlaces } from '@/lib/services/search'

const mockPosts: [] = []

jest.mock('@/lib/analytics', () => ({
  analytics: { search: jest.fn() },
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
jest.mock('@/lib/hooks/useSavedRestaurants', () => ({
  useSavedRestaurants: () => new Set(),
}))
jest.mock('@/lib/hooks/useSearchResults', () => ({
  useSearchResults: ({ dbPlaces }: { dbPlaces: PlaceResult[] }) => ({
    postResults: [],
    peopleResults: [],
    placeResults: dbPlaces,
    placeDistances: new Map(),
    expansionLabel: null,
  }),
}))
jest.mock('@/lib/services/googlePlaces', () => ({
  fetchPlaceAutocompleteJson: jest.fn().mockResolvedValue({ predictions: [] }),
}))
jest.mock('@/lib/services/posts', () => ({
  fetchPostsByIds: jest.fn().mockResolvedValue([]),
  mapRowToPost: jest.fn(),
}))
jest.mock('@/lib/services/search', () => ({
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
})
