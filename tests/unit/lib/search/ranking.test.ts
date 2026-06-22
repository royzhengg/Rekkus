import { rankSearchCandidates } from '@/lib/search/ranking'
import type {
  DishResult,
  PlaceResult,
  SearchCandidatePayload,
  SearchContext,
  SearchUserResult,
} from '@/lib/search/types'
import type { ParsedQuery } from '@/lib/utils/queryParser'
import type { SearchIntentKind } from '@/lib/utils/searchIntent'

function makeContext(intent: SearchIntentKind, query = 'ramen'): SearchContext {
  const words = query.split(/\s+/).filter(Boolean)
  const parsed: ParsedQuery = {
    raw: query,
    normalised: query,
    intent: intent === 'food_dish' ? 'dish' : intent === 'place_name' ? 'place' : 'general',
    cuisineTerms: [],
    dishTerms: intent === 'food_dish' ? words : [],
    locationTerms: intent === 'location' ? words : [],
    occasionTerms: [],
    dietaryTerms: [],
    qualityTerms: [],
    searchWords: words,
    isPrefix: false,
    detectedPhrases: [],
    resolvedSuburb: null,
  }
  return {
    rawQuery: query,
    query,
    words,
    parsed,
    intent,
    mode: 'search',
    radiusKm: 10,
    userId: null,
    filters: undefined,
    userLocation: null,
    locationSource: 'none',
    suburbFilter: undefined,
    bounds: undefined,
    hasQuery: true,
    isAroundMe: false,
    dishIntentActive: intent === 'food_dish' || intent === 'mixed',
    dishQuery: query,
    placeQuery: query,
  }
}

const dish: DishResult = {
  id: 'dish-1',
  name: 'Ramen',
  cuisine_type: 'Japanese',
  top_photo_url: null,
  save_count: 4,
  post_count: 3,
}

const place: PlaceResult = {
  id: 'place-1',
  name: 'Ramen Bar',
  address: '1 Food Street',
  city: 'Sydney',
  cuisine_type: 'Japanese',
  google_place_id: null,
  latitude: null,
  longitude: null,
  google_rating: null,
  google_review_count: null,
}

const user: SearchUserResult = {
  id: 'user-1',
  username: 'ramenfan',
  full_name: 'Ramen Fan',
  follower_count: 5,
  post_count: 2,
}

function postCandidate(id: string, rank: number, createdAt?: string | null): Extract<SearchCandidatePayload, { kind: 'post' }> {
  return { kind: 'post', id, source: 'post_fts', rank, ...(createdAt != null ? { createdAt } : {}) }
}

function dishCandidate(id: string, rank: number, overrides: Partial<DishResult> = {}): SearchCandidatePayload {
  return { kind: 'dish', id, source: 'dish_fts', rank, item: { ...dish, id, ...overrides } }
}

function localPlaceCandidate(id: string, rank: number, overrides: Partial<PlaceResult> = {}): SearchCandidatePayload {
  return { kind: 'place', id, source: 'local', rank, item: { ...place, id, ...overrides } }
}

function providerPlaceCandidate(id: string, rank: number): SearchCandidatePayload {
  return {
    kind: 'place',
    id,
    source: 'provider',
    rank,
    item: { ...place, id, google_place_id: id, fromGoogle: true },
  }
}

describe('rankSearchCandidates', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('adds a dish, post, and place diversity prelude for broad food queries', () => {
    const ranked = rankSearchCandidates(makeContext('food_dish'), [
      postCandidate('post-1', 2),
      localPlaceCandidate('place-1', 12),
      dishCandidate('dish-1', 1),
      postCandidate('post-2', 1),
    ])

    expect(ranked.slice(0, 3).map(candidate => candidate.kind)).toEqual(['dish', 'post', 'place'])
    expect(ranked.slice(0, 3).map(candidate => candidate.diversitySlot)).toEqual([
      'top_dish',
      'top_post',
      'top_place',
    ])
    const first = ranked[0]
    expect(first).toBeDefined()
    expect(first?.rankingReasons).toContain('diversity_prelude')
  })

  it('keeps local places ahead for restaurant-name intent', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      dishCandidate('dish-1', 12),
      postCandidate('post-1', 12),
      localPlaceCandidate('place-1', 8),
    ])

    const first = ranked[0]
    expect(first).toEqual(expect.objectContaining({ kind: 'place', source: 'local' }))
    expect(first?.diversitySlot).toBeUndefined()
  })

  it('keeps provider places below local Rekkus places at comparable source rank', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      providerPlaceCandidate('provider-1', 10),
      localPlaceCandidate('local-1', 10),
    ])

    expect(ranked.map(candidate => candidate.id)).toEqual(['local-1', 'provider-1'])
    expect(ranked[0]?.rankingReasons).toContain('local_source')
    expect(ranked[1]?.rankingReasons).toContain('provider_source')
  })

  it('adds exact-match explanation and ranks exact local candidates above weak matches', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      localPlaceCandidate('weak', 10, { name: 'Ramen Bar House' }),
      localPlaceCandidate('exact', 10, { name: 'Ramen Bar' }),
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({
      id: 'exact',
      rankingReasons: expect.arrayContaining(['exact_match']),
      explanationBadges: expect.arrayContaining(['Exact match']),
    }))
  })

  it('downranks keyword-stuffed candidates without suppressing clean matches', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen'), [
      localPlaceCandidate('stuffed', 10, { name: 'Ramen Ramen Ramen Ramen Bar' }),
      localPlaceCandidate('clean', 9, { name: 'Ramen Bar' }),
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({ id: 'clean' }))
    expect(ranked[1]).toEqual(expect.objectContaining({
      id: 'stuffed',
      rankingReasons: expect.arrayContaining(['keyword_stuffing_penalty']),
    }))
  })

  it('collapses duplicate place candidates and prefers local evidence deterministically', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      providerPlaceCandidate('provider-1', 20),
      localPlaceCandidate('local-1', 8, {
        name: 'Ramen Bar',
        city: 'Sydney',
        google_place_id: 'provider-1',
      }),
    ])

    expect(ranked).toHaveLength(1)
    expect(ranked[0]).toEqual(expect.objectContaining({ id: 'local-1', source: 'local' }))
  })

  it('does not give provider predictions first-party trust badges', () => {
    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      providerPlaceCandidate('provider-1', 10),
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({
      source: 'provider',
      rankingReasons: expect.not.arrayContaining(['exact_match', 'nearby_signal', 'popular_nearby']),
      explanationBadges: [],
    }))
  })

  it('adds nearby, popular nearby, and trending explanation badges for local places', () => {
    const ranked = rankSearchCandidates(
      {
        ...makeContext('place_name', 'ramen bar'),
        userLocation: { lat: -33.87, lng: 151.21 },
        locationSource: 'gps',
      },
      [
        {
          ...localPlaceCandidate('local-1', 10, {
            latitude: -33.8701,
            longitude: 151.2101,
            postCount: 5,
          }),
          trendingScore: 50,
        },
      ]
    )

    expect(ranked[0]).toEqual(expect.objectContaining({
      rankingReasons: expect.arrayContaining(['nearby_signal', 'popular_nearby', 'trending_signal']),
      explanationBadges: expect.arrayContaining(['Near you', 'Popular nearby', 'Trending']),
    }))
  })

  it('tie-breaks by score, entity priority, source rank, then id', () => {
    const ranked = rankSearchCandidates(makeContext('general', 'food'), [
      postCandidate('post-b', 4),
      localPlaceCandidate('place-a', 4),
      postCandidate('post-a', 4),
      {
        kind: 'person',
        id: 'user-1',
        source: 'user',
        rank: 1,
        item: user,
      },
    ])

    expect(ranked.map(candidate => candidate.id)).toEqual(['place-a', 'post-a', 'post-b', 'user-1'])
  })

  it('gives recent low-volume posts measured exposure inside the freshness window only', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T00:00:00.000Z'))

    const recent = rankSearchCandidates(makeContext('general', 'ramen'), [
      postCandidate('post-z', 1, '2026-06-01T00:00:00.000Z'),
      postCandidate('post-a', 1, '2026-01-01T00:00:00.000Z'),
    ])
    expect(recent.map(candidate => candidate.id)).toEqual(['post-z', 'post-a'])
    expect(recent[0]?.rankingReasons).toContain('freshness_boost')
    expect(recent[0]?.rankingReasons).toContain('cold_start_exposure')

    const stale = rankSearchCandidates(makeContext('general', 'ramen'), [
      postCandidate('post-z', 1, '2026-02-01T00:00:00.000Z'),
      postCandidate('post-a', 1, '2026-01-01T00:00:00.000Z'),
    ])
    expect(stale.map(candidate => candidate.id)).toEqual(['post-a', 'post-z'])
  })

  it('gives recent low-volume dishes and places exposure over stale high-volume peers', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T00:00:00.000Z'))

    const dishes = rankSearchCandidates(makeContext('food_dish', 'ramen'), [
      dishCandidate('dish-old', 4, {
        post_count: 12,
        latestPostedAt: '2026-01-01T00:00:00.000Z',
        firstPostedAt: '2025-12-01T00:00:00.000Z',
      }),
      dishCandidate('dish-new', 4, {
        post_count: 1,
        latestPostedAt: '2026-06-01T00:00:00.000Z',
        firstPostedAt: '2026-06-01T00:00:00.000Z',
      }),
    ])
    expect(dishes[0]).toEqual(expect.objectContaining({ id: 'dish-new' }))
    expect(dishes[0]?.rankingReasons).toContain('cold_start_exposure')

    const places = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      localPlaceCandidate('place-old', 4, {
        postCount: 8,
        latestPostedAt: '2026-01-01T00:00:00.000Z',
        firstPostedAt: '2025-12-01T00:00:00.000Z',
      }),
      localPlaceCandidate('place-new', 4, {
        postCount: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
        firstPostedAt: '2026-06-01T00:00:00.000Z',
        latestPostedAt: '2026-06-01T00:00:00.000Z',
      }),
    ])
    expect(places[0]).toEqual(expect.objectContaining({ id: 'place-new' }))
    expect(places[1]?.rankingReasons).toContain('popularity_decay')
  })

  it('does not let freshness beat stronger source rank and restaurant intent', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T00:00:00.000Z'))

    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      dishCandidate('dish-new', 6, {
        post_count: 1,
        latestPostedAt: '2026-06-01T00:00:00.000Z',
        firstPostedAt: '2026-06-01T00:00:00.000Z',
      }),
      localPlaceCandidate('place-strong', 8, {
        postCount: 6,
        latestPostedAt: '2026-01-01T00:00:00.000Z',
      }),
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({ id: 'place-strong' }))
  })

  it('does not apply freshness to provider predictions', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T00:00:00.000Z'))

    const ranked = rankSearchCandidates(makeContext('place_name', 'ramen bar'), [
      providerPlaceCandidate('provider-1', 10),
    ])

    expect(ranked[0]?.rankingReasons).toContain('provider_source')
    expect(ranked[0]?.rankingReasons).not.toContain('freshness_boost')
    expect(ranked[0]?.rankingReasons).not.toContain('cold_start_exposure')
  })

  it('decays stale popularity without erasing stronger text relevance', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T00:00:00.000Z'))

    const ranked = rankSearchCandidates(makeContext('food_dish', 'ramen'), [
      dishCandidate('dish-weak', 2, {
        post_count: 1,
        latestPostedAt: '2026-06-01T00:00:00.000Z',
        firstPostedAt: '2026-06-01T00:00:00.000Z',
      }),
      dishCandidate('dish-strong-stale', 5, {
        post_count: 20,
        latestPostedAt: '2026-01-01T00:00:00.000Z',
      }),
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({ id: 'dish-strong-stale' }))
    expect(ranked[0]?.rankingReasons).toContain('popularity_decay')
  })

  it('adds bounded personalization and trending reasons without replacing source rank', () => {
    const ranked = rankSearchCandidates(makeContext('general', 'ramen'), [
      localPlaceCandidate('plain', 4),
      {
        ...localPlaceCandidate('personalized', 4),
        personalizationBoost: 4,
        personalizationReasons: ['saved_place'],
        trendingScore: 100,
      },
    ])

    expect(ranked[0]).toEqual(expect.objectContaining({
      id: 'personalized',
      personalizationReasons: ['saved_place'],
      trendingScore: 100,
      rankingReasons: expect.arrayContaining(['personalized_signal', 'trending_signal']),
    }))
  })
})

describe('rankSearchCandidates — occasion boost + content score (Fix 2)', () => {
  function makeOccasionContext(occasionTerms: string[]): SearchContext {
    const ctx = makeContext('general', 'birthday dinner')
    return {
      ...ctx,
      parsed: { ...ctx.parsed, occasionTerms: occasionTerms as never },
    }
  }

  function placeWithTags(id: string, tags: string[], postCount = 0): SearchCandidatePayload {
    return {
      kind: 'place',
      id,
      source: 'local',
      rank: 1,
      item: { ...place, id, occasion_tags: tags, postCount },
    }
  }

  describe('occasion boost', () => {
    it('ranks a tagged place above an untagged place when occasionTerms match', () => {
      const ctx = makeOccasionContext(['special'])
      const ranked = rankSearchCandidates(ctx, [
        placeWithTags('tagged', ['special']),
        placeWithTags('untagged', []),
      ])
      const taggedScore = ranked.find(r => r.id === 'tagged')!.rankingScore
      const untaggedScore = ranked.find(r => r.id === 'untagged')!.rankingScore
      expect(taggedScore).toBeGreaterThan(untaggedScore)
    })

    it('adds occasion_match to rankingReasons for matched place', () => {
      const ctx = makeOccasionContext(['special'])
      const ranked = rankSearchCandidates(ctx, [placeWithTags('tagged', ['special'])])
      expect(ranked[0]!.rankingReasons).toContain('occasion_match')
    })

    it('does not boost when occasionTerms is empty', () => {
      const ctx = makeOccasionContext([])
      const ranked = rankSearchCandidates(ctx, [
        placeWithTags('tagged', ['special']),
        placeWithTags('untagged', []),
      ])
      const taggedScore = ranked.find(r => r.id === 'tagged')!.rankingScore
      const untaggedScore = ranked.find(r => r.id === 'untagged')!.rankingScore
      // scores should be equal (same rank, no occasion boost)
      expect(taggedScore).toBe(untaggedScore)
    })

    it('does not boost when place tags do not match occasion terms', () => {
      const ctx = makeOccasionContext(['special'])
      const ranked = rankSearchCandidates(ctx, [
        placeWithTags('tagged', ['casual']),
        placeWithTags('untagged', []),
      ])
      const taggedScore = ranked.find(r => r.id === 'tagged')!.rankingScore
      const untaggedScore = ranked.find(r => r.id === 'untagged')!.rankingScore
      expect(taggedScore).toBe(untaggedScore)
    })

    it('ranks higher-matching place above lower when both partially match', () => {
      const ctx = makeOccasionContext(['special'])
      const ranked = rankSearchCandidates(ctx, [
        placeWithTags('no-match', ['casual']),
        placeWithTags('match', ['special', 'date_night']),
      ])
      const matchScore = ranked.find(r => r.id === 'match')!.rankingScore
      const noMatchScore = ranked.find(r => r.id === 'no-match')!.rankingScore
      expect(matchScore).toBeGreaterThan(noMatchScore)
    })

    it('adds Great for this badge to matched place', () => {
      const ctx = makeOccasionContext(['special'])
      const ranked = rankSearchCandidates(ctx, [placeWithTags('tagged', ['special'])])
      expect(ranked[0]!.explanationBadges).toContain('Great for this')
    })
  })

  describe('content score', () => {
    it('ranks place with more posts above place with fewer posts when all else equal', () => {
      const ctx = makeOccasionContext([])
      const recentDate = new Date(Date.now() - 86_400_000).toISOString() // 1 day ago
      // Both above cold-start threshold (>1 post) so neither gets a cold-start boost
      const richCandidate: SearchCandidatePayload = {
        kind: 'place', id: 'rich', source: 'local', rank: 1,
        item: { ...place, id: 'rich', postCount: 50, latestPostedAt: recentDate },
      }
      const fewerCandidate: SearchCandidatePayload = {
        kind: 'place', id: 'fewer', source: 'local', rank: 1,
        item: { ...place, id: 'fewer', postCount: 2, latestPostedAt: recentDate },
      }
      const ranked = rankSearchCandidates(ctx, [richCandidate, fewerCandidate])
      const richScore = ranked.find(r => r.id === 'rich')!.rankingScore
      const fewerScore = ranked.find(r => r.id === 'fewer')!.rankingScore
      expect(richScore).toBeGreaterThan(fewerScore)
    })

    it('caps content boost so a place with 10000 posts cannot overwhelm text match', () => {
      const ctx = makeOccasionContext([])
      const ranked = rankSearchCandidates(ctx, [
        placeWithTags('huge', [], 10000),
        placeWithTags('tiny', [], 0),
      ])
      const hugScore = ranked.find(r => r.id === 'huge')!.rankingScore
      const tinyScore = ranked.find(r => r.id === 'tiny')!.rankingScore
      // boost should be capped — max difference should be the cap value (0.5)
      expect(hugScore - tinyScore).toBeLessThanOrEqual(0.5 + 0.001)
    })

    it('treats undefined postCount as 0', () => {
      const ctx = makeOccasionContext([])
      const candidateWithout: SearchCandidatePayload = {
        kind: 'place', id: 'no-count', source: 'local', rank: 1,
        item: { ...place, id: 'no-count' },
      }
      const candidateWith = placeWithTags('with-count', [], 0)
      const ranked = rankSearchCandidates(ctx, [candidateWithout, candidateWith])
      const scoreWithout = ranked.find(r => r.id === 'no-count')!.rankingScore
      const scoreWith = ranked.find(r => r.id === 'with-count')!.rankingScore
      expect(scoreWithout).toBe(scoreWith)
    })
  })
})
