// Search quality tests — B-585
//
// Tests ranking PRINCIPLES using pure scoring functions from searchScoring.ts.
// No DB calls. All synchronous.
//
// These are ordering-invariant tests: they assert that result A ranks above result B
// for a given query, not that any specific numeric score is returned. Changing scoring
// weights should fail these tests if the change breaks a principle.
//
// Mocks mirror tests/unit/lib/utils/searchScoring.test.ts exactly.

jest.mock('@/lib/featureFlags', () => ({ isEnabled: jest.fn().mockReturnValue(false) }))
jest.mock('@/lib/dataSources/cuisines', () => ({ normalizeCuisine: jest.fn((x: string) => x) }))

import type { PlaceResult } from '@/lib/hooks/searchTypes'
import { applySearchSynonymRows, resetSearchSynonymsForTest } from '@/lib/utils/cuisineSynonyms'
import {
  scorePost,
  scorePlace,
  popularityBoost,
  rekkusPickBoost,
  computePostResults,
  computePlaceResults,
} from '@/lib/utils/searchScoring'
import type { Post } from '@/types/domain'

// ─── Factories ────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    dbId: 'post-1',
    title: 'Ramen',
    body: 'Rich broth',
    creator: 'roy',
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
    cuisine_type: 'Japanese',
    ...overrides,
  }
}

function makePlace(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'rest-1',
    name: 'Ramen Bar',
    address: '1 Food Street',
    city: 'Sydney',
    cuisine_type: 'Japanese',
    google_place_id: 'google-1',
    latitude: -33.87,
    longitude: 151.21,
    google_rating: 4.4,
    google_review_count: 100,
    open_now: true,
    ...overrides,
  }
}

const basePlaceArgs = {
  posts: [] as Post[],
  expandedDbPlaces: [] as PlaceResult[],
  expansionCuisines: [],
  googlePredictions: [],
  interactionCounts: new Map<string, number>(),
  popularityCache: new Map(),
  searchAffinities: {},
  userLocation: null,
  savedRestaurantIds: new Set<string>(),
  radiusKm: 1000,
  isAroundMe: false,
  words: ['ramen'],
  filters: undefined,
}

// ─── Text relevance — posts ───────────────────────────────────────────────────

describe('Text relevance — posts', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it('beef post ranks above chicken post for "beef" query', () => {
    const beefPost = makePost({ title: 'Wagyu Beef Brisket', cuisine_type: 'Korean', tags: [] })
    const chickenPost = makePost({ id: 2, dbId: 'post-2', title: 'Chicken Karaage', cuisine_type: 'Japanese', tags: [] })
    expect(scorePost(beefPost, ['beef'])).toBeGreaterThan(scorePost(chickenPost, ['beef']))
  })

  it('exact restaurant name in title ranks above body-only mention', () => {
    const titlePost = makePost({ title: 'Mamak Malaysian Kitchen', body: 'Great rotis', cuisine_type: 'Malaysian', tags: [] })
    const bodyPost = makePost({ id: 2, dbId: 'post-2', title: 'Roti Heaven', body: 'Reminds me of mamak stalls', cuisine_type: 'Malaysian', tags: [] })
    expect(scorePost(titlePost, ['mamak'])).toBeGreaterThan(scorePost(bodyPost, ['mamak']))
  })

  it('cuisine_type match ranks above body mention of the same cuisine word', () => {
    const cuisinePost = makePost({ title: 'Noodle Bar', body: 'Great food', cuisine_type: 'Thai', tags: [] })
    const bodyPost = makePost({ id: 2, dbId: 'post-2', title: 'Noodle Bar', body: 'Best thai around', cuisine_type: 'Korean', tags: [] })
    expect(scorePost(cuisinePost, ['thai'])).toBeGreaterThan(scorePost(bodyPost, ['thai']))
  })

  it('post with no matching words returns score 0', () => {
    const post = makePost({ title: 'Sushi Platter', body: 'Fresh fish', cuisine_type: 'Japanese', tags: [] })
    expect(scorePost(post, ['pizza'])).toBe(0)
  })

  it('multi-word query returns 0 when only one word matches', () => {
    const post = makePost({ title: 'Ramen Shop', body: 'Great noodles', cuisine_type: 'Japanese', tags: [] })
    expect(scorePost(post, ['ramen', 'pizza'])).toBe(0)
  })
})

// ─── Text relevance — places ──────────────────────────────────────────────────

describe('Text relevance — places', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it('restaurant with query word in name ranks above same-cuisine restaurant without it', () => {
    const namedPlace = makePlace({ id: 'named', name: 'Wagyu Beef Burger Bar', cuisine_type: 'American' })
    const cuisineOnly = makePlace({ id: 'cuisine', name: 'American Kitchen', cuisine_type: 'American' })
    expect(scorePlace(namedPlace, ['beef'])).toBeGreaterThan(scorePlace(cuisineOnly, ['beef']))
  })

  it('exact cuisine_type match scores higher than name match for a cuisine keyword', () => {
    const directCuisine = makePlace({ id: 'direct', name: 'Garden House', cuisine_type: 'Korean' })
    const cuisineInName = makePlace({ id: 'inname', name: 'Korean Kitchen', cuisine_type: 'Chinese' })
    // 'korean' is a CUISINE_TYPE_WORD so name matching is skipped for cuisineInName
    expect(scorePlace(directCuisine, ['korean'])).toBeGreaterThan(scorePlace(cuisineInName, ['korean']))
  })

  it('place with no matching fields returns score 0', () => {
    const place = makePlace({ name: 'Sushi Palace', cuisine_type: 'Japanese' })
    expect(scorePlace(place, ['pizza'])).toBe(0)
  })
})

// ─── Location ranking ─────────────────────────────────────────────────────────

describe('Location ranking — places', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it('nearby restaurant (<500m) ranks above far restaurant (Melbourne) with equal quality', () => {
    const nearPlace = makePlace({
      id: 'near',
      name: 'Ramen Bar',
      cuisine_type: 'Japanese',
      latitude: -33.8705,
      longitude: 151.21,
      google_rating: 4.0,
      google_review_count: 100,
    })
    const farPlace = makePlace({
      id: 'far',
      name: 'Ramen Bar',
      cuisine_type: 'Japanese',
      latitude: -37.81,
      longitude: 144.96,
      google_rating: 4.0,
      google_review_count: 100,
    })

    const result = computePlaceResults({
      ...basePlaceArgs,
      dbPlaces: [farPlace, nearPlace],
      userLocation: { lat: -33.87, lng: 151.21 },
    })

    expect(result.placeResults[0]?.id).toBe('near')
  })

  it('near-you badge appears for places within 2km when user location provided', () => {
    const nearPlace = makePlace({
      id: 'close',
      name: 'Ramen Bar',
      cuisine_type: 'Japanese',
      latitude: -33.87,
      longitude: 151.21,
    })

    const result = computePlaceResults({
      ...basePlaceArgs,
      dbPlaces: [nearPlace],
      userLocation: { lat: -33.87, lng: 151.21 },
    })

    expect(result.placeResults[0]?.badges).toBeDefined()
    const badges = result.placeResults[0]?.badges ?? []
    expect(badges.some((b: string) => b.toLowerCase().includes('near'))).toBe(true)
  })
})

// ─── Popularity signals ───────────────────────────────────────────────────────

describe('Popularity signals', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it('popularityBoost returns 0 for zero posts and interactions', () => {
    expect(popularityBoost(0, 0)).toBe(0)
  })

  it('popularityBoost increases with post count', () => {
    expect(popularityBoost(5, 0)).toBeGreaterThan(popularityBoost(1, 0))
    expect(popularityBoost(1, 0)).toBeGreaterThan(popularityBoost(0, 0))
  })

  it('popularityBoost increases with interaction count', () => {
    expect(popularityBoost(5, 50)).toBeGreaterThan(popularityBoost(5, 0))
  })

  it('restaurant with 5 Rekkus posts ranks above 0-post restaurant at equal text score', () => {
    const popularPlace = makePlace({
      id: 'popular',
      name: 'Ramen Bar',
      cuisine_type: 'Japanese',
      latitude: -33.87,
      longitude: 151.21,
    })
    const unpopularPlace = makePlace({
      id: 'unpopular',
      name: 'Ramen Bar',
      cuisine_type: 'Japanese',
      latitude: -33.87,
      longitude: 151.21,
    })
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: i + 1, dbId: `p${i}`, placeId: 'popular' })
    )

    const result = computePlaceResults({
      ...basePlaceArgs,
      posts,
      dbPlaces: [unpopularPlace, popularPlace],
    })

    expect(result.placeResults[0]?.id).toBe('popular')
  })

  it('rekkusPickBoost returns higher value for worth_a_trip than standard post', () => {
    const pickPost = makePost({ tasteVerdict: 'worth_a_trip' })
    const normalPost = makePost({ tasteVerdict: undefined })
    expect(rekkusPickBoost(pickPost)).toBeGreaterThan(rekkusPickBoost(normalPost))
  })

  it('Rekkus pick post ranks above standard post at identical FTS rank', () => {
    const pickPost = makePost({ dbId: 'pick', title: 'Ramen', tasteVerdict: 'worth_a_trip' })
    const normalPost = makePost({ id: 2, dbId: 'normal', title: 'Ramen' })

    const result = computePostResults({
      posts: [normalPost, pickPost],
      ftsDbPosts: [],
      ftsPostIds: [
        { id: 'pick', rank: 0.5 },
        { id: 'normal', rank: 0.5 },
      ],
      expandedDbPosts: [],
      dishPostIds: new Map(),
      words: ['ramen'],
      userLocation: null,
      expansionCuisines: [],
      isAroundMe: false,
      filters: undefined,
    })

    expect(result.postResults[0]?.dbId).toBe('pick')
  })
})

// ─── Entity intent routing ────────────────────────────────────────────────────

describe('Entity intent routing', () => {
  beforeEach(() => resetSearchSynonymsForTest())

  it('cuisine keyword routes through cuisine_type only — name-only match returns 0', () => {
    // 'japanese' is a CUISINE_TYPE_WORD; name matching is skipped
    const nameOnlyMatch = makePlace({ id: 'n', name: 'Japanese Tapas', cuisine_type: 'Korean' })
    expect(scorePlace(nameOnlyMatch, ['japanese'])).toBe(0)
  })

  it('cuisine keyword grants score when cuisine_type matches', () => {
    const typeMatch = makePlace({ id: 't', name: 'Dragon Palace', cuisine_type: 'Chinese' })
    expect(scorePlace(typeMatch, ['chinese'])).toBeGreaterThan(0)
  })

  it('dish-matched post ranks above non-matched post at same FTS rank via dishPostIds boost', () => {
    const dishPost = makePost({ dbId: 'dish', title: 'Wagyu Beef' })
    const normalPost = makePost({ id: 2, dbId: 'normal', title: 'Wagyu Beef' })

    const result = computePostResults({
      posts: [normalPost, dishPost],
      ftsDbPosts: [],
      ftsPostIds: [
        { id: 'dish', rank: 0.5 },
        { id: 'normal', rank: 0.5 },
      ],
      expandedDbPosts: [],
      dishPostIds: new Map([['dish', { rank: 1, match_source: 'exact' }]]),
      words: ['wagyu', 'beef'],
      userLocation: null,
      expansionCuisines: [],
      isAroundMe: false,
      filters: undefined,
    })

    expect(result.postResults[0]?.dbId).toBe('dish')
  })

  it('synonym expansion: "ramen" query grants score to Japanese cuisine post when synonym loaded', () => {
    applySearchSynonymRows([{ term: 'ramen', canonical: 'japanese', type: 'cuisine' }])
    const japanesePost = makePost({ title: 'Noodle House', cuisine_type: 'Japanese', body: '', tags: [], location: 'Sydney' })
    const koreanPost = makePost({ id: 2, dbId: 'post-2', title: 'BBQ House', cuisine_type: 'Korean', body: '', tags: [], location: 'Sydney' })
    expect(scorePost(japanesePost, ['ramen'])).toBeGreaterThan(scorePost(koreanPost, ['ramen']))
  })
})
