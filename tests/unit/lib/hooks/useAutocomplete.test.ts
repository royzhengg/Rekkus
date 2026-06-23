import { act, renderHook } from '@testing-library/react-native'
import type { SearchSuggestion } from '@/lib/hooks/searchTypes'
import { __clearAutocompleteCacheForTest, useAutocomplete } from '@/lib/hooks/useAutocomplete'
import { fetchSearchAutocomplete } from '@/lib/services/search'

jest.mock('@/lib/featureFlags', () => ({
  isEnabled: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/services/search', () => ({
  fetchSearchAutocomplete: jest.fn(),
}))

jest.mock('@/lib/utils/locationResolver', () => ({
  resolveFromAliasCache: jest.fn(),
  resolveSuburbQuery: jest.fn().mockResolvedValue(null),
}))

const mockFetchSearchAutocomplete = jest.mocked(fetchSearchAutocomplete)

function deferred<T>() {
  let complete: ((value: T) => void) | undefined
  const promise = new Promise<T>(resolve => {
    complete = resolve
  })
  return {
    promise,
    resolve(value: T) {
      complete?.(value)
    },
  }
}

function suggestion(text: string): SearchSuggestion {
  return {
    suggestion_type: 'place',
    display_text: text,
    secondary_text: 'Sydney',
    entity_id: text,
    score: 1,
  }
}

describe('useAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    __clearAutocompleteCacheForTest()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not publish an older result after a newer query resolves first', async () => {
    const first = deferred<SearchSuggestion[]>()
    const second = deferred<SearchSuggestion[]>()
    mockFetchSearchAutocomplete.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook<SearchSuggestion[], { query: string }>(
      ({ query }) => useAutocomplete(query, null),
      { initialProps: { query: 'ramen' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    rerender({ query: 'sushi' })
    await act(async () => {
      jest.advanceTimersByTime(100)
      second.resolve([suggestion('Sushi')])
      await Promise.resolve()
    })
    expect(result.current).toEqual([suggestion('Sushi')])

    await act(async () => {
      first.resolve([suggestion('Ramen')])
      await Promise.resolve()
    })
    expect(result.current).toEqual([suggestion('Sushi')])
  })

  it('invalidates an in-flight result immediately when the query is cleared', async () => {
    const pending = deferred<SearchSuggestion[]>()
    mockFetchSearchAutocomplete.mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderHook<SearchSuggestion[], { query: string }>(
      ({ query }) => useAutocomplete(query, null),
      { initialProps: { query: 'ramen' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    rerender({ query: '' })
    await act(async () => {
      pending.resolve([suggestion('Ramen')])
      await Promise.resolve()
    })

    expect(result.current).toEqual([])
  })

  it('clears suggestions when the autocomplete fetch rejects', async () => {
    mockFetchSearchAutocomplete.mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useAutocomplete('ramen', null))
    await act(async () => {
      jest.advanceTimersByTime(100)
      await Promise.resolve()
    })

    expect(result.current).toEqual([])
  })

  it('dedupes identical prefix requests through the in-memory cache', async () => {
    mockFetchSearchAutocomplete.mockResolvedValueOnce([suggestion('Ramen')])

    const { result, rerender } = renderHook<SearchSuggestion[], { query: string }>(
      ({ query }) => useAutocomplete(query, null),
      { initialProps: { query: 'ramen' } }
    )

    await act(async () => {
      jest.advanceTimersByTime(100)
      await Promise.resolve()
    })
    expect(result.current).toEqual([suggestion('Ramen')])

    rerender({ query: ' ramen ' })
    await act(async () => {
      jest.advanceTimersByTime(100)
      await Promise.resolve()
    })

    expect(result.current).toEqual([suggestion('Ramen')])
    expect(mockFetchSearchAutocomplete).toHaveBeenCalledTimes(1)
  })
})
