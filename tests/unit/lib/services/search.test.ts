import AsyncStorage from '@react-native-async-storage/async-storage'
import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { fetchPostsByCuisines } from '@/lib/services/posts'
import {
  fetchTrendingPlaceClicks,
  fetchTrendingSearches,
  fetchSearchSynonyms,
  fetchRecentSearchHistory,
  resolveSearchExpansion,
  searchDishPostIds,
  searchDishes,
  searchPlaces,
  searchPostIds,
} from '@/lib/services/search'
import { supabase } from '@/lib/supabase'
import { applySearchSynonymRows, resetSearchSynonymsForTest } from '@/lib/utils/cuisineSynonyms'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('@/lib/services/boundaryTelemetry', () => ({
  reportInvalidBoundary: jest.fn(),
}))

jest.mock('@/lib/services/posts', () => ({
  fetchPostsByCuisines: jest.fn().mockResolvedValue([]),
  mapRowToPost: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}))

const mockRpc = jest.mocked(supabase.rpc)
const mockFrom = jest.mocked(supabase.from)
const mockGetItem = jest.mocked(AsyncStorage.getItem)
const mockSetItem = jest.mocked(AsyncStorage.setItem)
const mockFetchPostsByCuisines = jest.mocked(fetchPostsByCuisines)
const mockReportInvalidBoundary = jest.mocked(reportInvalidBoundary)

const validPlace = {
  id: 'rest-1',
  name: 'Ramen Bar',
  address: '1 Food Street',
  city: 'Sydney',
  cuisine_type: 'Japanese',
  google_place_id: 'google-1',
  latitude: -33.87,
  longitude: 151.21,
  google_rating: 4.5,
  google_review_count: 100,
}

function mockSearchSynonymsQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const eq = jest.fn(() => ({ limit }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValue({ select } as never)
}

function mockTrendingSearchQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const secondOrder = jest.fn(() => ({ limit }))
  const firstOrder = jest.fn(() => ({ order: secondOrder }))
  const eq = jest.fn(() => ({ order: firstOrder }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

function mockRestaurantIdsByCityQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const ilike = jest.fn(() => ({ limit }))
  const select = jest.fn(() => ({ ilike }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

function mockPlaceClickQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const inFilter = jest.fn(() => ({ limit }))
  const gte = jest.fn(() => ({ in: inFilter, limit }))
  const eq = jest.fn(() => ({ gte }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

describe('fetchSearchSynonyms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetSearchSynonymsForTest()
  })

  it('returns fresh AsyncStorage cache without querying Supabase', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({
      savedAt: new Date().toISOString(),
      rows: [{ term: 'boba', canonical: 'bubble tea', type: 'cuisine' }],
    }))

    await expect(fetchSearchSynonyms()).resolves.toEqual([
      { term: 'boba', canonical: 'bubble tea', type: 'cuisine' },
    ])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('fetches enabled DB rows and writes a normalized cache when cache is missing', async () => {
    mockGetItem.mockResolvedValue(null)
    mockSearchSynonymsQuery([
      { term: ' Boba ', canonical: ' Bubble Tea ', type: 'cuisine' },
      { term: '', canonical: 'ignored', type: 'cuisine' },
      { term: 'bad', canonical: 'ignored', type: 'unknown' },
    ])

    await expect(fetchSearchSynonyms()).resolves.toEqual([
      { term: 'boba', canonical: 'bubble tea', type: 'cuisine' },
    ])
    expect(mockFrom).toHaveBeenCalledWith('search_synonyms')
    expect(mockSetItem).toHaveBeenCalledWith(
      'rekkus:search-synonyms:v1',
      expect.stringContaining('"boba"')
    )
  })

  it('ignores stale cache and refreshes from the DB', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({
      savedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      rows: [{ term: 'old', canonical: 'stale', type: 'cuisine' }],
    }))
    mockSearchSynonymsQuery([{ term: 'bbq', canonical: 'american', type: 'cuisine' }])

    await expect(fetchSearchSynonyms()).resolves.toEqual([
      { term: 'bbq', canonical: 'american', type: 'cuisine' },
    ])
  })

  it('falls back to local constants when cache is malformed and DB fails', async () => {
    mockGetItem.mockResolvedValue('{bad json')
    mockSearchSynonymsQuery(null, new Error('db unavailable'))

    const rows = await fetchSearchSynonyms()
    expect(rows).toEqual(expect.arrayContaining([
      { term: 'ramen', canonical: 'japanese', type: 'cuisine' },
      { term: 'date night', canonical: 'date_night', type: 'occasion' },
      { term: 'gluten free', canonical: 'gluten_free', type: 'dietary' },
    ]))
  })
})

describe('fetchTrendingSearches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns city rows without global fallback when the city has enough results', async () => {
    mockTrendingSearchQuery([
      { query: 'ramen', near_city: 'Melbourne', score: 8 },
      { query: 'brunch', near_city: 'Melbourne', score: 7 },
      { query: 'dumplings', near_city: 'Melbourne', score: 6 },
      { query: 'gelato', near_city: 'Melbourne', score: 5 },
    ])

    await expect(fetchTrendingSearches(6, 'Melbourne')).resolves.toEqual([
      { query: 'ramen', near_city: 'Melbourne', score: 8 },
      { query: 'brunch', near_city: 'Melbourne', score: 7 },
      { query: 'dumplings', near_city: 'Melbourne', score: 6 },
      { query: 'gelato', near_city: 'Melbourne', score: 5 },
    ])
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('backfills global rows when city trending is sparse', async () => {
    mockTrendingSearchQuery([{ query: 'ramen', near_city: 'Melbourne', score: 8 }])
    mockTrendingSearchQuery([
      { query: 'ramen', near_city: 'global', score: 10 },
      { query: 'pizza', near_city: 'global', score: 9 },
      { query: 'sushi', near_city: 'global', score: 8 },
      { query: 'brunch', near_city: 'global', score: 7 },
    ])

    await expect(fetchTrendingSearches(4, 'Melbourne')).resolves.toEqual([
      { query: 'ramen', near_city: 'Melbourne', score: 8 },
      { query: 'pizza', near_city: 'global', score: 9 },
      { query: 'sushi', near_city: 'global', score: 8 },
      { query: 'brunch', near_city: 'global', score: 7 },
    ])
  })
})

describe('fetchTrendingPlaceClicks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns city-filtered place clicks when the city has enough results', async () => {
    mockRestaurantIdsByCityQuery([{ id: 'rest-1' }, { id: 'rest-2' }])
    mockPlaceClickQuery([
      { entity_id: 'rest-1' },
      { entity_id: 'rest-1' },
      { entity_id: 'rest-2' },
      { entity_id: 'rest-2' },
    ])

    await expect(fetchTrendingPlaceClicks('2026-05-25T00:00:00.000Z', 'Melbourne')).resolves.toEqual([
      { entity_id: 'rest-1' },
      { entity_id: 'rest-1' },
      { entity_id: 'rest-2' },
      { entity_id: 'rest-2' },
    ])
    expect(mockFrom).toHaveBeenCalledWith('restaurants')
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
  })

  it('backfills global place clicks without double-counting city restaurants', async () => {
    mockRestaurantIdsByCityQuery([{ id: 'rest-1' }])
    mockPlaceClickQuery([{ entity_id: 'rest-1' }])
    mockPlaceClickQuery([
      { entity_id: 'rest-1' },
      { entity_id: 'rest-2' },
      { entity_id: 'rest-3' },
    ])

    await expect(fetchTrendingPlaceClicks('2026-05-25T00:00:00.000Z', 'Melbourne')).resolves.toEqual([
      { entity_id: 'rest-1' },
      { entity_id: 'rest-2' },
      { entity_id: 'rest-3' },
    ])
  })
})

describe('searchPlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalises valid place rows and reports filtered provider rows', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace, { id: 9 }], error: null } as never)

    await expect(searchPlaces('ramen', null)).resolves.toEqual([validPlace])
    expect(mockRpc).toHaveBeenCalledWith('search_restaurants_full_text', {
      query_text: 'ramen',
      max_results: 40,
    })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('search_places_row_invalid')
  })

  it('uses bounding box lookup rather than text lookup for nearby requests', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace], error: null } as never)
    const bounds = { min_lat: -34, max_lat: -33, min_lng: 151, max_lng: 152 }

    await searchPlaces('ramen', null, bounds)

    expect(mockRpc).toHaveBeenCalledWith('restaurants_in_bounding_box', {
      ...bounds,
      max_results: 50,
    })
  })
})

describe('searchDishes', () => {
  const validDish = {
    id: 'dish-1',
    name: 'Matcha Latte',
    cuisine_type: 'Japanese',
    top_photo_url: 'https://example.com/photo.jpg',
    save_count: 12,
    post_count: 5,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns parsed dish rows and reports filtered rows', async () => {
    mockRpc.mockResolvedValue({
      data: [validDish, { id: 99 }],
      error: null,
    } as never)

    const result = await searchDishes('matcha latte', null)
    expect(result).toEqual([validDish])
    expect(mockRpc).toHaveBeenCalledWith('search_dishes_full_text', {
      query: 'matcha latte',
      max_results: 5,
    })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('search_dishes_full_text')
  })

  it('returns empty array on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('db error') } as never)
    const result = await searchDishes('pizza', null)
    expect(result).toEqual([])
  })

  it('passes location coordinates when provided', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null } as never)
    await searchDishes('ramen', { lat: -33.87, lng: 151.21 })
    expect(mockRpc).toHaveBeenCalledWith('search_dishes_full_text', {
      query: 'ramen',
      near_lat: -33.87,
      near_lng: 151.21,
      max_results: 5,
    })
  })
})

describe('searchPostIds', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns ranked post ids from RPC result', async () => {
    mockRpc.mockResolvedValue({ data: [{ post_id: 'p1', score: 1.0 }], error: null } as never)
    const result = await searchPostIds('ramen', null)
    expect(Array.isArray(result)).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('search_posts_full_text', expect.objectContaining({
      query_text: 'ramen',
      max_results: 20,
    }))
  })

  it('includes location params when user location is provided', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null } as never)
    await searchPostIds('sushi', { lat: -33.87, lng: 151.21 })
    expect(mockRpc).toHaveBeenCalledWith('search_posts_full_text', expect.objectContaining({
      near_lat: -33.87,
      near_lng: 151.21,
    }))
  })
})

describe('searchDishPostIds', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns dish post ids from RPC result', async () => {
    mockRpc.mockResolvedValue({ data: [{ post_id: 'p2', dish_id: 'd1', score: 0.9 }], error: null } as never)
    const result = await searchDishPostIds('matcha', null)
    expect(Array.isArray(result)).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('search_posts_by_dish', expect.objectContaining({
      dish_query: 'matcha',
      max_results: 20,
    }))
  })
})

describe('fetchRecentSearchHistory', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('returns search history rows from RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ query: 'ramen', searched_at: '2026-05-31' }], error: null } as never)
    const result = await fetchRecentSearchHistory(10, 30)
    expect(Array.isArray(result)).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('get_recent_search_history', { max_results: 10, lookback_days: 30 })
  })

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('db error') } as never)
    await expect(fetchRecentSearchHistory(10, 30)).rejects.toThrow('db error')
  })
})

describe('resolveSearchExpansion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPostsByCuisines.mockResolvedValue([])
    resetSearchSynonymsForTest()
  })

  it('uses deterministic cuisine synonyms without an expansion RPC', async () => {
    const result = await resolveSearchExpansion({
      isAroundMe: false,
      strictPostCount: 0,
      strictPlaceCount: 1,
      words: ['ramen'],
      q: 'ramen',
    })

    expect(result.cuisines).toEqual([{ cuisine_type: 'japanese', match_count: 1 }])
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockFetchPostsByCuisines).toHaveBeenCalledWith(['japanese'], 20)
  })

  it('uses backend cuisine expansion when no deterministic synonym exists', async () => {
    mockRpc.mockResolvedValue({
      data: [{ cuisine_type: 'fusion', match_count: 2 }],
      error: null,
    } as never)

    const result = await resolveSearchExpansion({
      isAroundMe: false,
      strictPostCount: 0,
      strictPlaceCount: 1,
      words: ['chef'],
      q: 'chef',
    })

    expect(mockRpc).toHaveBeenCalledWith('expand_search_cuisines', {
      query_text: 'chef',
      max_cuisines: 3,
    })
    expect(result.cuisines).toEqual([{ cuisine_type: 'fusion', match_count: 2 }])
  })

  it('uses hydrated DB cuisine synonyms before backend expansion', async () => {
    applySearchSynonymRows([{ term: 'boba', canonical: 'bubble tea', type: 'cuisine' }])

    const result = await resolveSearchExpansion({
      isAroundMe: false,
      strictPostCount: 0,
      strictPlaceCount: 1,
      words: ['boba'],
      q: 'boba',
    })

    expect(result.cuisines).toEqual([{ cuisine_type: 'bubble tea', match_count: 1 }])
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockFetchPostsByCuisines).toHaveBeenCalledWith(['bubble tea'], 20)
  })
})
