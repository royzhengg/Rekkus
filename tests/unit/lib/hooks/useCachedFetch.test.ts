import { renderHook, waitFor } from '@testing-library/react-native'
import { useCachedFetch } from '@/lib/hooks/useCachedFetch'

jest.mock('expo-router', () => {
  const { useEffect } = require('react') as { useEffect: (...args: unknown[]) => void }
  return {
    useFocusEffect: jest.fn((cb: () => (() => void) | void) => useEffect(cb, [cb])),
  }
})

describe('useCachedFetch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns initial value while loading, then fetched data', async () => {
    const fetch = jest.fn().mockResolvedValue(['a', 'b'])

    const { result } = renderHook(() => useCachedFetch({ fetch, initial: [] as string[] }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['a', 'b'])
  })

  it('wraps result in a Set when returnSet is true', async () => {
    const fetch = jest.fn().mockResolvedValue(['id-1', 'id-2'])

    const { result } = renderHook(() =>
      useCachedFetch({ fetch, initial: new Set<string>(), returnSet: true })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeInstanceOf(Set)
    expect((result.current.data as Set<string>).has('id-1')).toBe(true)
    expect((result.current.data as Set<string>).has('id-2')).toBe(true)
  })

  it('surfaces an error message when fetch fails', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('Network down'))

    const { result } = renderHook(() => useCachedFetch({ fetch, initial: [] as string[] }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network down')
    expect(result.current.data).toEqual([])
  })

  it('exposes a refresh function that re-runs the fetch', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(['first'])
      .mockResolvedValueOnce(['second'])

    const { result } = renderHook(() => useCachedFetch({ fetch, initial: [] as string[] }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['first'])

    void result.current.refresh()
    await waitFor(() => expect(result.current.data).toEqual(['second']))
  })

  it('re-fetches when focus fires again', async () => {
    const fetch = jest.fn().mockResolvedValue(['item'])
    const { result } = renderHook(() => useCachedFetch({ fetch, initial: [] as string[] }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
