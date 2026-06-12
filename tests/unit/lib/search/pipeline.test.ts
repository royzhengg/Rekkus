import { buildSearchContext } from '@/lib/search/context'
import { runSearchPipeline } from '@/lib/search/pipeline'
import type { PlaceResult } from '@/lib/search/types'
import { fetchPlaceAutocompleteJson } from '@/lib/services/googlePlaces'
import {
  fetchDishGraphEvidence,
  resolveSearchExpansion,
  searchDishes,
  searchDishPostIds,
  searchPlaces,
  searchPostIds,
  searchUsers,
} from '@/lib/services/search'
import { fetchSearchPersonalizationSignals } from '@/lib/services/searchPersonalization'
import { fetchTrendingEntitySignals } from '@/lib/services/trending'
import type { Post } from '@/types/domain'

jest.mock('@/lib/dataSources/cuisines', () => ({ normalizeCuisine: jest.fn((x: string) => x) }))
jest.mock('@/lib/featureFlags', () => ({ isEnabled: jest.fn().mockReturnValue(false) }))
jest.mock('@/lib/services/googlePlaces', () => ({
  fetchPlaceAutocompleteJson: jest.fn().mockResolvedValue({ predictions: [] }),
}))
jest.mock('@/lib/services/search', () => ({
  fetchDishGraphEvidence: jest.fn().mockResolvedValue(new Map()),
  searchUsers: jest.fn().mockResolvedValue([]),
  searchPlaces: jest.fn().mockResolvedValue([]),
  searchPostIds: jest.fn().mockResolvedValue([]),
  searchDishPostIds: jest.fn().mockResolvedValue([]),
  searchDishes: jest.fn().mockResolvedValue([]),
  resolveSearchExpansion: jest.fn().mockResolvedValue({
    cuisines: [],
    expandedPosts: [],
    expandedPlaces: [],
  }),
}))
jest.mock('@/lib/services/searchPersonalization', () => ({
  fetchSearchPersonalizationSignals: jest.fn().mockResolvedValue({
    recentQueries: [],
    recentCuisines: [],
    recentAreas: [],
    savedRestaurantIds: [],
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
jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn(),
  resolveSuburbQuery: jest.fn().mockResolvedValue(null),
  cacheResolvedSuburb: jest.fn(),
}))

const mockSearchUsers = jest.mocked(searchUsers)
const mockFetchDishGraphEvidence = jest.mocked(fetchDishGraphEvidence)
const mockSearchPlaces = jest.mocked(searchPlaces)
const mockSearchPostIds = jest.mocked(searchPostIds)
const mockSearchDishPostIds = jest.mocked(searchDishPostIds)
const mockSearchDishes = jest.mocked(searchDishes)
const mockResolveSearchExpansion = jest.mocked(resolveSearchExpansion)
const mockFetchPlaceAutocompleteJson = jest.mocked(fetchPlaceAutocompleteJson)
const mockFetchSearchPersonalizationSignals = jest.mocked(fetchSearchPersonalizationSignals)
const mockFetchTrendingEntitySignals = jest.mocked(fetchTrendingEntitySignals)

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

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    dbId: 'post-1',
    title: 'Ramen',
    body: 'Rich broth',
    creator: 'Roy',
    initials: 'RO',
    avatarBg: '#fff',
    avatarColor: '#000',
    likes: '0',
    imgKey: 'warm',
    tall: false,
    tags: [],
    location: 'Ramen Bar',
    food: 4,
    vibe: 4,
    cost: 3,
    ...overrides,
  }
}

describe('runSearchPipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchUsers.mockResolvedValue([])
    mockSearchPlaces.mockResolvedValue([])
    mockSearchPostIds.mockResolvedValue([])
    mockSearchDishPostIds.mockResolvedValue([])
    mockSearchDishes.mockResolvedValue([])
    mockFetchDishGraphEvidence.mockResolvedValue(new Map())
    mockFetchSearchPersonalizationSignals.mockResolvedValue({
      recentQueries: [],
      recentCuisines: [],
      recentAreas: [],
      savedRestaurantIds: [],
      savedDishIds: [],
      savedPostIds: [],
    })
    mockFetchTrendingEntitySignals.mockResolvedValue({
      placeScores: new Map(),
      postScores: new Map(),
      dishScores: new Map(),
    })
    mockResolveSearchExpansion.mockResolvedValue({
      cuisines: [],
      expandedPosts: [],
      expandedPlaces: [],
    })
    mockFetchPlaceAutocompleteJson.mockResolvedValue({ predictions: [] })
  })

  it('runs unified retrieval for users, places, posts, dish posts, and dish entities', async () => {
    mockSearchUsers.mockResolvedValueOnce([
      { id: 'user-1', username: 'roy', full_name: 'Roy', follower_count: 10, post_count: 2 },
    ])
    mockSearchPlaces.mockResolvedValueOnce([place])
    mockSearchPostIds.mockResolvedValueOnce([{ id: 'post-1', rank: 0.7 }])
    mockSearchDishPostIds.mockResolvedValueOnce([{ id: 'post-2', rank: 0.9, match_source: 'fts' }])
    mockSearchDishes.mockResolvedValueOnce([
      {
        id: 'dish-1',
        name: 'Ramen',
        cuisine_type: 'Japanese',
        top_photo_url: null,
        save_count: 3,
        post_count: 4,
      },
    ])

    const context = await buildSearchContext({ query: 'ramen', userLocation: null })
    const result = await runSearchPipeline(context, { posts: [] })

    expect(mockSearchUsers).toHaveBeenCalledWith('ramen')
    expect(mockSearchPlaces).toHaveBeenCalledWith('ramen', null, undefined, undefined)
    expect(mockSearchPostIds).toHaveBeenCalledWith('ramen', null)
    expect(mockSearchDishPostIds).toHaveBeenCalledWith('ramen', null)
    expect(mockSearchDishes).toHaveBeenCalledWith('ramen', null)
    expect(result.candidates.slice(0, 3).map(candidate => candidate.kind)).toEqual([
      'dish',
      'post',
      'place',
    ])
    expect(result.candidates.slice(0, 3).map(candidate => candidate.diversitySlot)).toEqual([
      'top_dish',
      'top_post',
      'top_place',
    ])
    expect(result.candidates[0]).toEqual(expect.objectContaining({
      rankingScore: expect.any(Number),
      rankingReasons: expect.arrayContaining(['source_rank', 'intent_entity_weight']),
    }))
  })

  it('suppresses unbounded Google fallback for ambiguous food without locality', async () => {
    const context = await buildSearchContext({ query: 'pork', userLocation: null })
    const result = await runSearchPipeline(context, { posts: [] })

    expect(mockFetchPlaceAutocompleteJson).not.toHaveBeenCalled()
    expect(result.providerFallbackSuppressed).toBe(true)
    expect(result.providerFallbackReason).toBe('ambiguous_food_without_location')
  })

  it('uses bounded Google fallback when locality exists', async () => {
    mockFetchPlaceAutocompleteJson.mockResolvedValueOnce({
      predictions: [
        {
          place_id: 'google-1',
          structured_formatting: {
            main_text: 'Pork House',
            secondary_text: 'Sydney NSW',
          },
          types: ['restaurant'],
        },
      ],
    })

    const location = { lat: -33.87, lng: 151.21 }
    const context = await buildSearchContext({ query: 'pork', userLocation: location })
    const result = await runSearchPipeline(context, { posts: [] })

    expect(mockFetchPlaceAutocompleteJson).toHaveBeenCalledWith('pork', location)
    expect(result.providerFallbackSuppressed).toBe(false)
    expect(result.providerPredictions).toHaveLength(1)
    expect(result.candidates.some(candidate => candidate.kind === 'place' && candidate.source === 'provider')).toBe(true)
  })

  it('emits first-class place and person candidates from local results', async () => {
    mockSearchPlaces.mockResolvedValueOnce([place])
    mockSearchUsers.mockResolvedValueOnce([
      { id: 'user-1', username: 'ramenfan', full_name: null, follower_count: 1, post_count: 1 },
    ])

    const context = await buildSearchContext({ query: 'ramen', userLocation: null })
    const result = await runSearchPipeline(context, { posts: [] })

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'place',
        id: 'rest-1',
        source: 'local',
        rankingScore: expect.any(Number),
      }),
      expect.objectContaining({
        kind: 'person',
        id: 'user-1',
        source: 'user',
        rankingReasons: expect.arrayContaining(['source_rank', 'intent_entity_weight']),
      }),
    ]))
  })

  it('copies local place explanation badges onto place results for current UI consumers', async () => {
    mockSearchPlaces.mockResolvedValueOnce([{
      ...place,
      name: 'Ramen Bar',
      latitude: -33.8701,
      longitude: 151.2101,
      postCount: 5,
    }])
    mockFetchTrendingEntitySignals.mockResolvedValueOnce({
      placeScores: new Map([['rest-1', 50]]),
      postScores: new Map(),
      dishScores: new Map(),
    })

    const context = await buildSearchContext({
      query: 'ramen bar',
      userLocation: { lat: -33.87, lng: 151.21 },
      options: { locationSource: 'gps' },
    })
    const result = await runSearchPipeline(context, { posts: [] })

    expect(result.places[0]?.badges).toEqual(expect.arrayContaining([
      'Exact match',
      'Near you',
      'Popular nearby',
      'Trending',
    ]))
    expect(result.candidates[0]).toEqual(expect.objectContaining({
      explanationBadges: expect.arrayContaining(['Exact match', 'Near you', 'Popular nearby', 'Trending']),
    }))
  })

  it('attaches available post freshness metadata to post candidates', async () => {
    mockSearchPostIds.mockResolvedValueOnce([{ id: 'post-1', rank: 0.7 }])

    const context = await buildSearchContext({ query: 'ramen', userLocation: null })
    const result = await runSearchPipeline(context, {
      posts: [makePost({ dbId: 'post-1', createdAt: '2026-06-01T00:00:00.000Z' })],
    })

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'post',
        id: 'post-1',
        createdAt: '2026-06-01T00:00:00.000Z',
      }),
    ]))
  })

  it('attaches graph, personalization, and trending metadata to candidates', async () => {
    mockSearchPlaces.mockResolvedValueOnce([{ ...place, top_dishes: ['Ramen'] }])
    mockSearchPostIds.mockResolvedValueOnce([{ id: 'post-1', rank: 0.7 }])
    mockSearchDishes.mockResolvedValueOnce([
      {
        id: 'dish-1',
        name: 'Ramen',
        cuisine_type: 'Japanese',
        top_photo_url: null,
        save_count: 3,
        post_count: 4,
      },
    ])
    mockFetchDishGraphEvidence.mockResolvedValueOnce(new Map([
      ['dish-1', {
        servingRestaurantIds: ['rest-1'],
        servingRestaurantCount: 1,
        supportingPostIds: ['post-1'],
      }],
    ]))
    mockFetchSearchPersonalizationSignals.mockResolvedValueOnce({
      recentQueries: ['ramen'],
      recentCuisines: ['japanese'],
      recentAreas: ['sydney'],
      savedRestaurantIds: ['rest-1'],
      savedDishIds: ['dish-1'],
      savedPostIds: ['post-1'],
    })
    mockFetchTrendingEntitySignals.mockResolvedValueOnce({
      placeScores: new Map([['rest-1', 4]]),
      postScores: new Map([['post-1', 5]]),
      dishScores: new Map([['dish-1', 9]]),
    })

    const context = await buildSearchContext({ query: 'ramen', userLocation: null, options: { userId: 'user-1' } })
    const result = await runSearchPipeline(context, {
      posts: [makePost({ dbId: 'post-1', createdAt: '2026-06-01T00:00:00.000Z' })],
    })

    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'dish',
        id: 'dish-1',
        graphEvidence: {
          servingRestaurantIds: ['rest-1'],
          servingRestaurantCount: 1,
          supportingPostIds: ['post-1'],
        },
        personalizationReasons: expect.arrayContaining(['saved_dish', 'recent_cuisine', 'recent_search']),
        trendingScore: 9,
        rankingReasons: expect.arrayContaining(['personalized_signal', 'trending_signal']),
      }),
      expect.objectContaining({
        kind: 'place',
        id: 'rest-1',
        personalizationReasons: expect.arrayContaining(['saved_restaurant', 'recent_cuisine', 'recent_area']),
        trendingScore: 4,
      }),
      expect.objectContaining({
        kind: 'post',
        id: 'post-1',
        personalizationReasons: ['saved_post'],
        trendingScore: 5,
      }),
    ]))
  })
})
