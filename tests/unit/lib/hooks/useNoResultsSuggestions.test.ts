import { renderHook } from '@testing-library/react-native'
import {
  useNoResultsSuggestions,
  type NoResultsSuggestionChip,
  type UserTasteContext,
} from '@/lib/hooks/useNoResultsSuggestions'

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
})
