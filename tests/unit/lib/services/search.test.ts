import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildSearchContext } from '@/lib/search/context'
import { reportInvalidBoundary } from '@/lib/services/boundaryTelemetry'
import { fetchPostsByCuisines } from '@/lib/services/posts'
import {
  fetchSearchSynonyms,
  fetchSavedSearches,
  fetchRecentSearchHistory,
  fetchSearchQualityMetrics,
  fetchSearchAutocomplete,
  normalizeSavedSearchQuery,
  resolveSearchExpansion,
  saveSearch,
  fetchDishGraphEvidence,
  searchDishPostIds,
  searchDishes,
  searchPlaces,
  searchPostIds,
  unsaveSearch,
} from '@/lib/services/search'
import {
  fetchPersonalizedSuggestions,
  fetchSearchPersonalizationSignals,
  fetchUserEngagementCuisines,
} from '@/lib/services/searchPersonalization'
import {
  fetchTrendingEntitySignals,
  fetchTrendingPlaceClicks,
  fetchTrendingSearches,
} from '@/lib/services/trending'
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
  const gte = jest.fn(() => ({ order: firstOrder }))
  const eq = jest.fn(() => ({ gte }))
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

function mockPostTrendQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const gte = jest.fn(() => ({ limit }))
  const inFilter = jest.fn(() => ({ gte }))
  const eq = jest.fn(() => ({ in: inFilter }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

function mockDishGraphQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const isFilter = jest.fn(() => ({ limit }))
  const inFilter = jest.fn(() => ({ is: isFilter }))
  const select = jest.fn(() => ({ in: inFilter }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

function mockEngagementCuisineQuery(data: unknown, error: Error | null = null): void {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const order = jest.fn(() => ({ limit }))
  const gte = jest.fn(() => ({ order }))
  const inFilter = jest.fn(() => ({ gte }))
  const eq = jest.fn(() => ({ in: inFilter }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValueOnce({ select } as never)
}

function mockSavedSearchFetch(data: unknown, error: Error | null = null) {
  const limit = jest.fn().mockResolvedValue({ data, error })
  const order = jest.fn(() => ({ limit }))
  const eq = jest.fn(() => ({ order }))
  const select = jest.fn(() => ({ eq }))
  mockFrom.mockReturnValueOnce({ select } as never)
  return { select, eq, order, limit }
}

function mockSavedSearchUpsert(data: unknown, error: Error | null = null) {
  const single = jest.fn().mockResolvedValue({ data, error })
  const select = jest.fn(() => ({ single }))
  const upsert = jest.fn(() => ({ select }))
  mockFrom.mockReturnValueOnce({ upsert } as never)
  return { upsert, select, single }
}

function mockSavedSearchDelete(error: Error | null = null) {
  const secondEq = jest.fn().mockResolvedValue({ error })
  const firstEq = jest.fn(() => ({ eq: secondEq }))
  const deleteFn = jest.fn(() => ({ eq: firstEq }))
  mockFrom.mockReturnValueOnce({ delete: deleteFn } as never)
  return { deleteFn, firstEq, secondEq }
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
    expect(mockFrom).toHaveBeenCalledWith('places')
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

describe('fetchUserEngagementCuisines', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns fresh AsyncStorage cache without querying Supabase', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({
      savedAt: new Date().toISOString(),
      cuisines: ['japanese', 'italian'],
    }))

    await expect(fetchUserEngagementCuisines('user-1')).resolves.toEqual(['japanese', 'italian'])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('aggregates cuisine metadata with save events weighted above views', async () => {
    mockGetItem.mockResolvedValue(null)
    mockEngagementCuisineQuery([
      { event_type: 'post_view', metadata: { cuisine_type: ' Japanese ' } },
      { event_type: 'place_view', metadata: { cuisine_type: 'Italian' } },
      { event_type: 'post_save', metadata: { cuisine_type: 'Italian' } },
      { event_type: 'place_save', metadata: { cuisine_type: 'Thai' } },
    ])

    await expect(fetchUserEngagementCuisines('user-1')).resolves.toEqual([
      'italian',
      'thai',
      'japanese',
    ])
    expect(mockFrom).toHaveBeenCalledWith('analytics_events')
    expect(mockSetItem).toHaveBeenCalledWith(
      'rekkus:engagement-cuisines:v1:user-1',
      expect.stringContaining('"italian"')
    )
  })

  it('filters malformed or missing cuisine metadata', async () => {
    mockGetItem.mockResolvedValue(null)
    mockEngagementCuisineQuery([
      { event_type: 'post_view', metadata: { cuisine_type: 42 } },
      { event_type: 'place_save', metadata: { cuisine_type: ' ' } },
      { event_type: 'post_save', metadata: { cuisine_type: 'Korean' } },
    ])

    await expect(fetchUserEngagementCuisines('user-1')).resolves.toEqual(['korean'])
  })

  it('returns an empty fallback when the query fails', async () => {
    mockGetItem.mockResolvedValue(null)
    mockEngagementCuisineQuery(null, new Error('db unavailable'))

    await expect(fetchUserEngagementCuisines('user-1')).resolves.toEqual([])
  })
})

describe('saved search services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes display queries without changing word order', () => {
    expect(normalizeSavedSearchQuery('  cheap   ramen near   me  ')).toBe('cheap ramen near me')
  })

  it('fetches saved searches with an explicit limit', async () => {
    const chain = mockSavedSearchFetch([
      { query: 'ramen' },
      { query: ' ' },
      { query: 'omakase CBD' },
    ])

    await expect(fetchSavedSearches('user-1', 5)).resolves.toEqual(['ramen', 'omakase CBD'])
    expect(mockFrom).toHaveBeenCalledWith('saved_searches')
    expect(chain.select).toHaveBeenCalledWith('query')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(5)
  })

  it('caps saved search fetch limits', async () => {
    const chain = mockSavedSearchFetch([])

    await fetchSavedSearches('user-1', 500)

    expect(chain.limit).toHaveBeenCalledWith(100)
  })

  it('upserts normalized saved searches by user and query key', async () => {
    const chain = mockSavedSearchUpsert({ query: 'Cheap Ramen' })

    await expect(saveSearch('  Cheap   Ramen  ')).resolves.toBe('Cheap Ramen')
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Cheap Ramen',
        normalized_query: 'cheap ramen',
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id,normalized_query' }
    )
    expect(chain.select).toHaveBeenCalledWith('query')
  })

  it('rejects blank saved searches before hitting Supabase', async () => {
    await expect(saveSearch(' x ')).rejects.toThrow('saved_search_query_too_short')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('unsaves by normalized query without touching recent history', async () => {
    const chain = mockSavedSearchDelete()

    await expect(unsaveSearch('  Cheap   RAMEN ')).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('saved_searches')
    expect(chain.deleteFn).toHaveBeenCalled()
    expect(chain.firstEq).toHaveBeenCalledWith('normalized_query', 'cheap ramen')
  })
})

describe('fetchSearchQualityMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches bounded aggregate search quality metric rows', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          day: '2026-06-02',
          result_type: null,
          result_position: null,
          search_sessions: 10,
          query_count: 12,
          click_count: 6,
          attributed_view_count: 5,
          attributed_save_count: 2,
          attributed_review_count: 0,
          zero_result_count: 1,
          reformulation_count: 3,
          success_count: 7,
          success_rate: 70,
          ctr: 50,
          zero_result_rate: 10,
          reformulation_rate: 25,
        },
        { day: 'bad' },
      ],
      error: null,
    } as never)

    await expect(fetchSearchQualityMetrics(500)).resolves.toEqual([
      {
        day: '2026-06-02',
        result_type: null,
        result_position: null,
        search_sessions: 10,
        query_count: 12,
        click_count: 6,
        attributed_view_count: 5,
        attributed_save_count: 2,
        attributed_review_count: 0,
        zero_result_count: 1,
        reformulation_count: 3,
        success_count: 7,
        success_rate: 70,
        ctr: 50,
        zero_result_rate: 10,
        reformulation_rate: 25,
      },
    ])
    expect(mockRpc).toHaveBeenCalledWith('get_search_quality_metrics', { lookback_days: 90 })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('search_quality_metrics_row_invalid')
  })
})

describe('fetchPersonalizedSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('parses valid RPC rows and reports malformed rows', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { query: ' ramen ', score: 4, source: 'saved_dish' },
        { query: '', score: 9, source: 'bad' },
        { query: 'broken', score: 'high', source: 'bad' },
      ],
      error: null,
    } as never)

    await expect(fetchPersonalizedSuggestions('user-1', 'nope', 5)).resolves.toEqual([
      { query: 'ramen', score: 4, source: 'saved_dish' },
    ])
    expect(mockRpc).toHaveBeenCalledWith('get_personalized_suggestions', {
      p_user_id: 'user-1',
      p_failed_query: 'nope',
      p_limit: 5,
    })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('personalized_suggestion_row_invalid')
  })

  it('caps the requested limit and returns empty on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('db unavailable') } as never)

    await expect(fetchPersonalizedSuggestions('user-1', 'nope', 50)).resolves.toEqual([])
    expect(mockRpc).toHaveBeenCalledWith('get_personalized_suggestions', {
      p_user_id: 'user-1',
      p_failed_query: 'nope',
      p_limit: 10,
    })
  })
})

describe('B-572/B-576/B-578/B-579 search services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches SearchContext-aware autocomplete suggestions and normalizes tags', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          suggestion_type: 'hashtag',
          display_text: 'ramen',
          secondary_text: '#ramen',
          entity_id: 'tag-1',
          score: 4,
        },
        {
          suggestion_type: 'area',
          display_text: 'Parramatta',
          secondary_text: 'Area',
          entity_id: 'Parramatta',
          score: 3,
        },
      ],
      error: null,
    } as never)

    const context = await buildSearchContext({ query: 'ramen', userLocation: null })

    await expect(fetchSearchAutocomplete(context)).resolves.toEqual([
      {
        suggestion_type: 'tag',
        display_text: 'ramen',
        secondary_text: '#ramen',
        entity_id: 'tag-1',
        score: 4,
      },
      {
        suggestion_type: 'area',
        display_text: 'Parramatta',
        secondary_text: 'Area',
        entity_id: 'Parramatta',
        score: 3,
      },
    ])
    expect(mockRpc).toHaveBeenCalledWith('suggest_searches', {
      prefix_query: 'ramen',
      limit_per_type: 3,
    })
  })

  it('builds bounded dish graph evidence from linked posts', async () => {
    mockDishGraphQuery([
      { id: 'post-1', dish_id: 'dish-1', place_id: 'rest-1' },
      { id: 'post-2', dish_id: 'dish-1', place_id: 'rest-2' },
      { id: 'post-3', dish_id: 'dish-1', place_id: 'rest-2' },
      { id: 9, dish_id: 'bad', place_id: 'bad' },
    ])

    const evidence = await fetchDishGraphEvidence(['dish-1'])

    expect(evidence.get('dish-1')).toEqual({
      servingPlaceIds: ['rest-1', 'rest-2'],
      servingPlaceCount: 2,
      supportingPostIds: ['post-1', 'post-2', 'post-3'],
    })
    expect(mockFrom).toHaveBeenCalledWith('posts')
  })

  it('returns empty personalization signals for anonymous users without querying Supabase', async () => {
    await expect(fetchSearchPersonalizationSignals(null)).resolves.toEqual({
      recentQueries: [],
      recentCuisines: [],
      recentAreas: [],
      savedPlaceIds: [],
      savedDishIds: [],
      savedPostIds: [],
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('aggregates privacy-safe trending entity scores', async () => {
    mockPlaceClickQuery([{ entity_id: 'rest-1' }, { entity_id: 'rest-1' }])
    mockPostTrendQuery([
      { event_type: 'post_view', entity_id: 'post-1' },
      { event_type: 'post_save', entity_id: 'post-1' },
    ])
    mockRpc.mockResolvedValueOnce({
      data: [{
        id: 'dish-1',
        name: 'Ramen',
        cuisine_type: 'Japanese',
        top_photo_url: null,
        save_count: 2,
        post_count: 3,
      }],
      error: null,
    } as never)

    const signals = await fetchTrendingEntitySignals()

    expect(signals.placeScores.get('rest-1')).toBe(2)
    expect(signals.postScores.get('post-1')).toBe(6)
    expect(signals.dishScores.get('dish-1')).toBe(9)
  })
})

describe('searchPlaces', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalises valid place rows and reports filtered provider rows', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace, { id: 9 }], error: null } as never)

    await expect(searchPlaces('ramen', null)).resolves.toEqual([validPlace])
    expect(mockRpc).toHaveBeenCalledWith('search_places_full_text', {
      query_text: 'ramen',
      max_results: 40,
    })
    expect(mockReportInvalidBoundary).toHaveBeenCalledWith('search_places_row_invalid')
  })

  it('maps place freshness metadata from RPC rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        ...validPlace,
        post_count: 1,
        created_at: '2026-06-01T00:00:00.000Z',
        first_posted_at: '2026-06-01T01:00:00.000Z',
        latest_posted_at: '2026-06-02T01:00:00.000Z',
      }],
      error: null,
    } as never)

    await expect(searchPlaces('ramen', null)).resolves.toEqual([{
      ...validPlace,
      postCount: 1,
      createdAt: '2026-06-01T00:00:00.000Z',
      firstPostedAt: '2026-06-01T01:00:00.000Z',
      latestPostedAt: '2026-06-02T01:00:00.000Z',
    }])
  })

  it('uses bounding box lookup rather than text lookup for nearby requests', async () => {
    mockRpc.mockResolvedValue({ data: [validPlace], error: null } as never)
    const bounds = { min_lat: -34, max_lat: -33, min_lng: 151, max_lng: 152 }

    await searchPlaces('ramen', null, bounds)

    expect(mockRpc).toHaveBeenCalledWith('places_in_bounding_box', {
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

  it('maps dish freshness metadata from RPC rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        ...validDish,
        first_posted_at: '2026-06-01T01:00:00.000Z',
        latest_posted_at: '2026-06-02T01:00:00.000Z',
      }],
      error: null,
    } as never)

    const result = await searchDishes('matcha latte', null)
    expect(result).toEqual([{
      ...validDish,
      firstPostedAt: '2026-06-01T01:00:00.000Z',
      latestPostedAt: '2026-06-02T01:00:00.000Z',
    }])
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
