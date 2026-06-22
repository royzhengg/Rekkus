// Mock modules that have side-effects at load time but aren't used by the tested function.
jest.mock('@/lib/featureFlags', () => ({ isEnabled: jest.fn().mockReturnValue(false) }))
jest.mock('@/lib/dataSources/cuisines', () => ({ normalizeCuisine: jest.fn((x: string) => x) }))

import { performance } from 'node:perf_hooks'
import type { PlaceResult } from '@/lib/hooks/searchTypes'
import { computePlaceResults } from '@/lib/utils/searchScoring'
import type { Post } from '@/types/domain'

const PLACE_COUNT = 100
const POST_COUNT = 1000
const WARMUP_RUNS = 3
const MEASURED_RUNS = 15
const MEDIAN_BUDGET_MS = 50

function makePlace(index: number): PlaceResult {
  return {
    id: `rest-${index}`,
    name: `Ramen Kitchen ${index}`,
    address: `${index} Food Street`,
    city: 'Sydney',
    suburb: 'Surry Hills',
    cuisine_type: 'Japanese',
    google_place_id: `google-${index}`,
    latitude: -33.87 + index * 0.0001,
    longitude: 151.21 + index * 0.0001,
    google_rating: 4 + (index % 10) / 10,
    google_review_count: 50 + index,
    open_now: true,
  }
}

function makePost(index: number): Post {
  const restaurantIndex = index % PLACE_COUNT
  return {
    id: index,
    dbId: `post-${index}`,
    title: `Ramen bowl ${index}`,
    body: 'Rich broth and springy noodles',
    creator: 'perf',
    initials: 'PF',
    avatarBg: '#fff',
    avatarColor: '#000',
    likes: '0',
    imgKey: 'warm',
    tall: false,
    tags: ['ramen'],
    location: `Ramen Kitchen ${restaurantIndex}`,
    food: 3 + (index % 3),
    vibe: 4,
    cost: 3,
    cuisine_type: 'Japanese',
    placeId: `rest-${restaurantIndex}`,
  }
}

function runSearch(places: PlaceResult[], posts: Post[]): void {
  computePlaceResults({
    posts,
    dbPlaces: places,
    expandedDbPlaces: [],
    expansionCuisines: [],
    googlePredictions: [],
    interactionCounts: new Map<string, number>(),
    popularityCache: new Map(),
    searchAffinities: {},
    userLocation: null,
    savedPlaceIds: new Set<string>(),
    radiusKm: 10,
    isAroundMe: false,
    words: ['ramen'],
    filters: undefined,
  })
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted[Math.floor(sorted.length / 2)]
  if (middle == null) throw new Error('Cannot calculate median for an empty measurement set')
  return middle
}

describe('computePlaceResults performance budget', () => {
  it(`keeps ${PLACE_COUNT} places and ${POST_COUNT} posts under ${MEDIAN_BUDGET_MS}ms median`, () => {
    const places = Array.from({ length: PLACE_COUNT }, (_, index) => makePlace(index))
    const posts = Array.from({ length: POST_COUNT }, (_, index) => makePost(index))

    for (let run = 0; run < WARMUP_RUNS; run += 1) {
      runSearch(places, posts)
    }

    const durations: number[] = []
    for (let run = 0; run < MEASURED_RUNS; run += 1) {
      const start = performance.now()
      runSearch(places, posts)
      durations.push(performance.now() - start)
    }

    const measuredMedian = median(durations)
    if (measuredMedian > MEDIAN_BUDGET_MS) {
      throw new Error(
        `computePlaceResults median ${measuredMedian.toFixed(2)}ms exceeded ${MEDIAN_BUDGET_MS}ms ` +
          `over ${MEASURED_RUNS} runs with ${PLACE_COUNT} places and ${POST_COUNT} posts`
      )
    }
  })
})
