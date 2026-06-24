import {
  activeFilterTokens,
  appendSearchSessionStep,
  classifySearchQuery,
  defaultSearchFilters,
  deserializeSearchFilters,
  normalizeQueryWithTaxonomyAliases,
  normalizeSearchFilters,
  searchFilterHash,
  serializeSearchFilters,
  type SearchIntent,
  type SearchSession,
} from '@/lib/search/filterContracts'
import {
  MAX_SEARCH_SESSION_STEPS,
  SEARCH_INTENT_OPTIONS,
} from '@/lib/search/searchConstants'

describe('search filter contracts', () => {
  it('defaults to All intent and best-match sorting', () => {
    expect(defaultSearchFilters.intent).toBe('all')
    expect(defaultSearchFilters.sort).toBe('best_match')
    expect(defaultSearchFilters.locationSource).toBeNull()
  })

  it('keeps SearchIntent explicit and includes All first', () => {
    const intents: SearchIntent[] = ['all', 'dishes', 'places', 'collections', 'posts', 'people']

    expect(SEARCH_INTENT_OPTIONS).toEqual([
      'all',
      'dishes',
      'collections',
      'places',
      'posts',
      'people',
    ])
    expect(intents).toContain('people')
  })

  it('normalizes legacy persisted filters into the food-first contract', () => {
    const filters = normalizeSearchFilters({
      cuisine: 'Japanese',
      dietary_flag: 'halal',
      sort: 'highest_rekkus_picks',
      radiusKm: 25,
      takeaway: true,
      outdoor_seating: true,
      taxonomies: {
        foodCategory: ['Ramen'],
        venueType: ['Izakaya'],
      },
      occasions: ['date_night'],
    })

    expect(filters).toMatchObject({
      intent: 'all',
      sort: 'popular',
      radiusKm: 25,
      taxonomies: {
        cuisine: ['Japanese'],
        dietary: ['halal'],
        foodCategory: ['Ramen'],
        venueType: ['Izakaya'],
      },
      traits: {
        takeaway: true,
        outdoorSeating: true,
      },
      occasions: ['date_night'],
    })
  })

  it('serializes, deserializes, and hashes normalized filters', () => {
    const filters = normalizeSearchFilters({
      intent: 'collections',
      sort: 'nearby',
      locationSource: 'manual',
      radiusKm: 50,
    })

    const serialized = serializeSearchFilters(filters)

    expect(deserializeSearchFilters(serialized)).toEqual(filters)
    expect(deserializeSearchFilters('not-json')).toEqual(defaultSearchFilters)
    expect(searchFilterHash(filters)).toBe(serialized)
  })

  it('returns compact active filter tokens', () => {
    const filters = normalizeSearchFilters({
      intent: 'places',
      sort: 'nearby',
      locationSource: 'profile',
      radiusKm: 10,
      taxonomies: {
        cuisine: ['Thai'],
        foodCategory: ['Noodles'],
      },
      traits: {
        openNow: true,
      },
    })

    expect(activeFilterTokens(filters)).toEqual([
      'Thai',
      'Noodles',
      'Open now',
      '10 km',
      'nearby',
      'places',
    ])
  })

  it('classifies the query before normalization and execution', () => {
    expect(classifySearchQuery('')).toBe('discovery')
    expect(classifySearchQuery('ramen')).toBe('food')
    expect(classifySearchQuery('Gumshara')).toBe('place')
    expect(classifySearchQuery('best ramen sydney')).toBe('collection')
    expect(classifySearchQuery('date night')).toBe('occasion')
    expect(classifySearchQuery('@roy')).toBe('creator')
  })

  it('normalizes queries with taxonomy-owned aliases only when provided', () => {
    const aliases = {
      jap: 'Japanese',
      tonkotsu: 'Ramen',
      bbq: 'Barbecue',
    }

    expect(normalizeQueryWithTaxonomyAliases('jap', aliases)).toBe('Japanese')
    expect(normalizeQueryWithTaxonomyAliases('late night tonkotsu', aliases)).toBe('late night Ramen')
    expect(normalizeQueryWithTaxonomyAliases('bbq', aliases)).toBe('Barbecue')
    expect(normalizeQueryWithTaxonomyAliases('matcha', aliases)).toBe('matcha')
  })

  it('keeps search session memory bounded and compact', () => {
    const session: SearchSession = {
      id: 'session-1',
      startedAt: 1,
      steps: [],
    }

    let result = session
    for (let index = 0; index < MAX_SEARCH_SESSION_STEPS + 3; index += 1) {
      result = appendSearchSessionStep(result, {
        query: `query-${index}`,
        intent: 'all',
        filterHash: `hash-${index}`,
      })
    }

    expect(result.steps).toHaveLength(MAX_SEARCH_SESSION_STEPS)
    expect(result.steps[0]).toEqual({
      query: 'query-3',
      intent: 'all',
      filterHash: 'hash-3',
    })
    expect(result.steps.at(-1)).toEqual({
      query: `query-${MAX_SEARCH_SESSION_STEPS + 2}`,
      intent: 'all',
      filterHash: `hash-${MAX_SEARCH_SESSION_STEPS + 2}`,
    })
    const firstStep = result.steps[0]
    expect(firstStep).toBeDefined()
    if (!firstStep) return
    expect(Object.keys(firstStep)).toEqual(['query', 'intent', 'filterHash'])
  })
})
