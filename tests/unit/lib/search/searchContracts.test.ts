import {
  createSearchResponse,
  type SearchResponse,
  type SearchSuggestion,
  type SearchViewState,
} from '@/lib/search/filterContracts'
import {
  DISCOVERY_MODULES,
  SEARCH_RADIUS_OPTIONS,
  SEARCH_RANKING_VERSION,
  SEARCH_SORT_OPTIONS,
  SEARCH_SUGGESTION_TYPE_PRIORITY,
} from '@/lib/search/searchConstants'
import { searchOwnership } from '@/lib/search/searchOwnership'

describe('search domain contracts', () => {
  it('anchors search responses with ranking version and cursor pagination', () => {
    const response: SearchResponse = createSearchResponse(
      [{ type: 'collection', id: 'collection-1', rankingReasons: ['matches_collection'] }],
      {
        suggestions: [
          {
            type: 'collection',
            id: 'collection-1',
            slug: 'best-ramen-sydney',
            label: 'Best Ramen Sydney',
          },
        ],
        totalCount: 12,
        nextCursor: 'cursor-2',
      }
    )

    expect(response).toEqual({
      rankingVersion: SEARCH_RANKING_VERSION,
      results: [
        {
          type: 'collection',
          id: 'collection-1',
          rankingReasons: ['matches_collection'],
        },
      ],
      suggestions: [
        {
          type: 'collection',
          id: 'collection-1',
          slug: 'best-ramen-sydney',
          label: 'Best Ramen Sydney',
        },
      ],
      totalCount: 12,
      nextCursor: 'cursor-2',
    })
  })

  it('requires stable IDs and slugs on suggestions, including occasions', () => {
    const suggestion: SearchSuggestion = {
      type: 'occasion',
      id: 'occasion-date-night',
      slug: 'date-night',
      label: 'Date night',
      detail: 'Occasion',
    }

    expect(suggestion).toMatchObject({
      type: 'occasion',
      id: expect.any(String),
      slug: expect.any(String),
      label: 'Date night',
    })
  })

  it('keeps view states explicit', () => {
    const states: SearchViewState[] = ['discovery', 'suggestions', 'results', 'empty']

    expect(states).toEqual(['discovery', 'suggestions', 'results', 'empty'])
  })

  it('keeps v1 radius, sort, suggestion, and discovery-module constants centralized', () => {
    expect(SEARCH_RADIUS_OPTIONS).toEqual([2, 5, 10, 25, 50])
    expect(SEARCH_SORT_OPTIONS).toEqual(['best_match', 'nearby', 'popular', 'newest'])
    expect(SEARCH_SUGGESTION_TYPE_PRIORITY).toEqual([
      'food_category',
      'cuisine',
      'occasion',
      'collection',
      'place',
      'user',
    ])
    expect(DISCOVERY_MODULES).toEqual([
      'near_you',
      'quick_discovery',
      'personal_suggestions',
      'for_you',
      'trending',
      'popular_collections',
      'popular_dishes',
      'popular_places',
      'top_creators',
    ])
  })

  it('documents domain ownership in executable constants', () => {
    expect(searchOwnership).toEqual({
      filtering: 'server',
      ranking: 'server',
      collectionOrdering: 'server',
      suggestionBaseRanking: 'server',
      suggestionClientBoosts: 'client_bounded',
      discoveryModuleOrdering: 'product',
      persistence: 'client',
      analytics: 'analytics_layer',
    })
  })
})
