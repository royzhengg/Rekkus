// Mock modules that have side-effects at load time but aren't used by the tested functions.
jest.mock('@/lib/featureFlags', () => ({ isEnabled: jest.fn().mockReturnValue(false) }))
jest.mock('@/lib/dataSources/cuisines', () => ({ normalizeCuisine: jest.fn((x: string) => x) }))

import type { PlaceResult } from '@/lib/hooks/searchTypes'
import {
  parseWords,
  fieldScore,
  uniqueBadges,
  boundingBoxForRadius,
  popularityBoost,
  computePostResults,
  computePlaceResults,
} from '@/lib/utils/searchScoring'
import type { Post } from '@/types/domain'

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

describe('parseWords', () => {
  it('lowercases and splits on whitespace', () => {
    expect(parseWords('Great Ramen')).toEqual(['great', 'ramen'])
  })

  it('strips # characters before splitting', () => {
    expect(parseWords('#ramen #tokyo')).toEqual(['ramen', 'tokyo'])
  })

  it('returns empty array for empty string', () => {
    expect(parseWords('')).toEqual([])
  })

  it('collapses multiple spaces', () => {
    expect(parseWords('tonkotsu  ramen')).toEqual(['tonkotsu', 'ramen'])
  })
})

describe('fieldScore', () => {
  it('returns strong score for exact token match', () => {
    expect(fieldScore('noodle bar', 'noodle', 3)).toBe(3)
  })

  it('returns partial score when word covers 40–80% of token', () => {
    // 'nood' (4) / 'noodle' (6) = 0.667 → 0.4 ≤ coverage < 0.8 → strong * 0.33
    expect(fieldScore('noodle bar', 'nood', 3)).toBeCloseTo(0.99)
  })

  it('returns 0 when word does not start the token', () => {
    expect(fieldScore('noodle bar', 'oodle', 3)).toBe(0)
  })

  it('returns 0 when text is empty', () => {
    expect(fieldScore('', 'noodle', 3)).toBe(0)
  })

  it('returns 0 when no token matches', () => {
    expect(fieldScore('sushi place', 'ramen', 3)).toBe(0)
  })
})

describe('uniqueBadges', () => {
  it('deduplicates values', () => {
    expect(uniqueBadges('Japanese', 'Ramen', 'Japanese')).toEqual(['Japanese', 'Ramen'])
  })

  it('filters out null and undefined', () => {
    expect(uniqueBadges('Ramen', null, undefined, 'Ramen')).toEqual(['Ramen'])
  })

  it('returns empty array when all values are null/undefined', () => {
    expect(uniqueBadges(null, undefined)).toEqual([])
  })

  it('returns empty array when called with no arguments', () => {
    expect(uniqueBadges()).toEqual([])
  })
})

describe('boundingBoxForRadius', () => {
  it('returns four bounding coordinates', () => {
    const box = boundingBoxForRadius({ lat: -33.87, lng: 151.21 }, 5)
    expect(box).toHaveProperty('min_lat')
    expect(box).toHaveProperty('max_lat')
    expect(box).toHaveProperty('min_lng')
    expect(box).toHaveProperty('max_lng')
  })

  it('min values are less than max values', () => {
    const box = boundingBoxForRadius({ lat: -33.87, lng: 151.21 }, 5)
    expect(box.min_lat).toBeLessThan(box.max_lat)
    expect(box.min_lng).toBeLessThan(box.max_lng)
  })

  it('larger radius produces wider bounding box', () => {
    const small = boundingBoxForRadius({ lat: -33.87, lng: 151.21 }, 1)
    const large = boundingBoxForRadius({ lat: -33.87, lng: 151.21 }, 50)
    expect(large.max_lat - large.min_lat).toBeGreaterThan(small.max_lat - small.min_lat)
  })
})

describe('popularityBoost', () => {
  it('returns 0 for zero posts and interactions', () => {
    expect(popularityBoost(0, 0)).toBe(0)
  })

  it('gives a small boost for 1 post', () => {
    expect(popularityBoost(1, 0)).toBe(0.25)
  })

  it('gives a medium boost for 2+ posts', () => {
    expect(popularityBoost(2, 0)).toBe(0.75)
    expect(popularityBoost(4, 0)).toBe(0.75)
  })

  it('gives the max post boost for 5+ posts', () => {
    expect(popularityBoost(5, 0)).toBe(1.5)
    expect(popularityBoost(100, 0)).toBe(1.5)
  })

  it('adds interaction boost on top of post boost', () => {
    expect(popularityBoost(5, 1)).toBeCloseTo(1.7)
    expect(popularityBoost(5, 5)).toBeCloseTo(1.9)
    expect(popularityBoost(5, 20)).toBeCloseTo(2.3)
    expect(popularityBoost(5, 50)).toBeCloseTo(3.0)
  })
})

describe('computePostResults', () => {
  it('uses server FTS rank as the primary result order', () => {
    const first = makePost({ dbId: 'post-1', title: 'First' })
    const second = makePost({ id: 2, dbId: 'post-2', title: 'Second' })

    const result = computePostResults({
      posts: [first, second],
      ftsDbPosts: [],
      ftsPostIds: [{ id: 'post-1', rank: 0.1 }, { id: 'post-2', rank: 0.7 }],
      expandedDbPosts: [],
      dishPostIds: new Map(),
      words: ['ramen'],
      userLocation: null,
      expansionCuisines: [],
      isAroundMe: false,
      filters: undefined,
    })

    expect(result.postResults.map(post => post.dbId)).toEqual(['post-2', 'post-1'])
    expect(result.usedPostExpansion).toBe(false)
  })

  it('falls back to expanded cuisines when strict results are absent', () => {
    const expanded = makePost({ dbId: 'post-expanded', title: 'Neighbourhood favourite' })

    const result = computePostResults({
      posts: [],
      ftsDbPosts: [],
      ftsPostIds: [],
      expandedDbPosts: [expanded],
      dishPostIds: new Map(),
      words: ['unknown'],
      userLocation: null,
      expansionCuisines: [{ cuisine_type: 'Japanese', match_count: 1 }],
      isAroundMe: false,
      filters: undefined,
    })

    expect(result.postResults).toEqual([expanded])
    expect(result.usedPostExpansion).toBe(true)
  })
})

describe('computePlaceResults', () => {
  const baseArgs = {
    posts: [] as Post[],
    expandedDbPlaces: [] as PlaceResult[],
    expansionCuisines: [],
    googlePredictions: [],
    interactionCounts: new Map<string, number>(),
    popularityCache: new Map(),
    searchAffinities: {},
    userLocation: null,
    savedRestaurantIds: new Set<string>(),
    radiusKm: 10,
    isAroundMe: false,
    words: ['ramen'],
    filters: undefined,
  }

  it('merges food Google predictions and rejects non-food venues', () => {
    const result = computePlaceResults({
      ...baseArgs,
      dbPlaces: [],
      googlePredictions: [
        {
          place_id: 'food-1',
          structured_formatting: { main_text: 'Ramen Kitchen', secondary_text: 'Sydney' },
          types: ['restaurant'],
        },
        {
          place_id: 'gym-1',
          structured_formatting: { main_text: 'Ramen Fitness', secondary_text: 'Sydney' },
          types: ['gym'],
        },
      ],
    })

    expect(result.placeResults.map(place => place.id)).toEqual(['food-1'])
  })

  it('applies radius and open filters for nearby discovery', () => {
    const result = computePlaceResults({
      ...baseArgs,
      dbPlaces: [
        makePlace({ id: 'near-open', latitude: -33.87, longitude: 151.21 }),
        makePlace({ id: 'near-closed', open_now: false }),
        makePlace({ id: 'far-open', latitude: -37.81, longitude: 144.96 }),
      ],
      isAroundMe: true,
      userLocation: { lat: -33.87, lng: 151.21 },
      radiusKm: 3,
      filters: { openNow: true },
      words: [],
    })

    expect(result.placeResults.map(place => place.id)).toEqual(['near-open'])
  })

  it('ranks a saved matching place above an otherwise equal match', () => {
    const saved = makePlace({ id: 'saved', google_place_id: 'saved-google' })
    const unsaved = makePlace({ id: 'unsaved', google_place_id: 'unsaved-google' })

    const result = computePlaceResults({
      ...baseArgs,
      dbPlaces: [unsaved, saved],
      savedRestaurantIds: new Set(['saved']),
    })

    expect(result.placeResults.map(place => place.id)).toEqual(['saved', 'unsaved'])
    expect(result.placeResults[0]?.badges).toContain('Saved')
  })
})
