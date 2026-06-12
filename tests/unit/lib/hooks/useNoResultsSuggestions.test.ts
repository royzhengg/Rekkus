import { act, renderHook } from '@testing-library/react-native'
import {
  useNoResultsSuggestions,
  type NoResultsSuggestionChip,
  type UserTasteContext,
} from '@/lib/hooks/useNoResultsSuggestions'
import { fetchPersonalizedSuggestions } from '@/lib/services/searchPersonalization'

jest.mock('@/lib/services/searchPersonalization', () => ({
  fetchPersonalizedSuggestions: jest.fn(),
}))

const mockFetchPersonalizedSuggestions = jest.mocked(fetchPersonalizedSuggestions)
let fakeTimersActive = false

const staticFallbacks: NoResultsSuggestionChip[] = [
  { label: 'Ramen', emoji: '🍜', query: 'ramen' },
  { label: 'Brunch', emoji: '☀️', query: 'brunch' },
  { label: 'Dumplings', emoji: '🥟', query: 'dumplings' },
]

function renderSuggestions(context: Partial<UserTasteContext>, failedQuery = 'nope') {
  return renderHook(() =>
    useNoResultsSuggestions(failedQuery, {
      cuisineAffinities: {},
      recentSearches: [],
      trendingSearches: [],
      staticFallbacks,
      ...context,
    })
  ).result.current
}

describe('useNoResultsSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fakeTimersActive = false
    jest.useRealTimers()
  })

  afterEach(() => {
    if (fakeTimersActive) {
      jest.runOnlyPendingTimers()
    }
    jest.useRealTimers()
  })

  it('orders cuisine affinities before recent, trending, and fallback suggestions', () => {
    const suggestions = renderSuggestions({
      cuisineAffinities: { italian: 0.7, japanese: 1 },
      recentSearches: ['pho'],
      trendingSearches: ['tacos'],
    })

    expect(suggestions.map(chip => chip.query)).toEqual(['japanese', 'italian', 'pho'])
  })

  it('fills remaining suggestions from recent searches after cuisines', () => {
    const suggestions = renderSuggestions({
      cuisineAffinities: { japanese: 1 },
      recentSearches: ['pasta', 'pho'],
      trendingSearches: ['tacos'],
    })

    expect(suggestions.map(chip => chip.query)).toEqual(['japanese', 'pasta', 'pho'])
  })

  it('inserts engagement cuisines after search affinities and before recent searches', () => {
    const suggestions = renderSuggestions({
      cuisineAffinities: { japanese: 1 },
      viewedCuisines: ['Italian', 'thai'],
      recentSearches: ['pho'],
      trendingSearches: ['tacos'],
    })

    expect(suggestions.map(chip => chip.query)).toEqual(['japanese', 'Italian', 'thai'])
  })

  it('fills remaining suggestions from trending searches after recent searches', () => {
    const suggestions = renderSuggestions({
      recentSearches: ['pasta'],
      trendingSearches: ['tacos', 'pho'],
    })

    expect(suggestions.map(chip => chip.query)).toEqual(['pasta', 'tacos', 'pho'])
  })

  it('uses static fallbacks when local signals are unavailable', () => {
    const suggestions = renderSuggestions({})

    expect(suggestions).toHaveLength(3)
    expect(suggestions.map(chip => chip.query)).toEqual(['ramen', 'brunch', 'dumplings'])
  })

  it('excludes the failed query from suggestions', () => {
    const suggestions = renderSuggestions({
      cuisineAffinities: { ramen: 1 },
      recentSearches: ['brunch'],
      trendingSearches: ['dumplings'],
    }, 'ramen')

    expect(suggestions.map(chip => chip.query)).toEqual(['brunch', 'dumplings'])
  })

  it('dedupes duplicate queries by first-priority source', () => {
    const suggestions = renderSuggestions({
      cuisineAffinities: { ramen: 1 },
      recentSearches: ['Ramen', 'pasta'],
      trendingSearches: ['pasta', 'brunch'],
    })

    expect(suggestions.map(chip => chip.query)).toEqual(['ramen', 'pasta', 'brunch'])
    expect(suggestions[0]).toEqual(staticFallbacks[0])
  })

  it('replaces local suggestions with server suggestions when they arrive', async () => {
    jest.useFakeTimers()
    fakeTimersActive = true
    mockFetchPersonalizedSuggestions.mockResolvedValue([
      { query: 'udon', score: 4, source: 'saved_dish' },
      { query: 'soba', score: 3, source: 'engagement_cuisine' },
    ])

    const { result } = renderHook(() =>
      useNoResultsSuggestions('nope', {
        userId: 'user-1',
        cuisineAffinities: {},
        recentSearches: ['pho'],
        trendingSearches: [],
        staticFallbacks,
      })
    )

    expect(result.current.map(chip => chip.query)).toEqual(['pho', 'ramen', 'brunch'])
    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current.map(chip => chip.query)).toEqual(['udon', 'soba'])
  })

  it('keeps local suggestions when server suggestions fail', async () => {
    jest.useFakeTimers()
    fakeTimersActive = true
    mockFetchPersonalizedSuggestions.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() =>
      useNoResultsSuggestions('nope', {
        userId: 'user-1',
        cuisineAffinities: {},
        recentSearches: ['pho'],
        trendingSearches: [],
        staticFallbacks,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    expect(mockFetchPersonalizedSuggestions).toHaveBeenCalled()
    expect(result.current.map(chip => chip.query)).toEqual(['pho', 'ramen', 'brunch'])
  })

  it('ignores stale server responses after the failed query changes', async () => {
    jest.useFakeTimers()
    fakeTimersActive = true
    let resolveFirst: (value: Array<{ query: string; score: number; source: string }>) => void = () => {}
    const firstRequest = new Promise<Array<{ query: string; score: number; source: string }>>(resolve => {
      resolveFirst = resolve
    })
    mockFetchPersonalizedSuggestions
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce([{ query: 'second pick', score: 2, source: 'search_history' }])

    const { result, rerender } = renderHook(
      ({ failedQuery }: { failedQuery: string }) =>
        useNoResultsSuggestions(failedQuery, {
          userId: 'user-1',
          cuisineAffinities: {},
          recentSearches: ['pho'],
          trendingSearches: [],
          staticFallbacks,
        }),
      { initialProps: { failedQuery: 'first miss' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(200)
    })
    rerender({ failedQuery: 'second miss' })
    await act(async () => {
      jest.advanceTimersByTime(200)
      resolveFirst([{ query: 'stale pick', score: 9, source: 'search_history' }])
    })

    expect((result.current as NoResultsSuggestionChip[]).map(chip => chip.query)).toEqual(['second pick'])
  })
})
