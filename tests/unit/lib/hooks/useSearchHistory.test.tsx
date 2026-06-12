import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import {
  fetchRecentSearchHistory,
  fetchRecentSearchHistoryFallback,
  fetchSavedSearches,
  saveSearch,
  unsaveSearch,
} from '@/lib/services/search'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    dismissSearchQuery: jest.fn(),
    saveSearch: jest.fn(),
    unsaveSearch: jest.fn(),
  },
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/services/search', () => ({
  fetchRecentSearchHistory: jest.fn(),
  fetchRecentSearchHistoryFallback: jest.fn(),
  fetchSavedSearches: jest.fn(),
  saveSearch: jest.fn(),
  unsaveSearch: jest.fn(),
  normalizeSavedSearchQuery: (query: string) => query.trim().replace(/\s+/g, ' '),
}))

const mockUseAuth = jest.mocked(useAuth)
const mockGetItem = jest.mocked(AsyncStorage.getItem)
const mockFetchRecentSearchHistory = jest.mocked(fetchRecentSearchHistory)
const mockFetchRecentSearchHistoryFallback = jest.mocked(fetchRecentSearchHistoryFallback)
const mockFetchSavedSearches = jest.mocked(fetchSavedSearches)
const mockSaveSearch = jest.mocked(saveSearch)
const mockUnsaveSearch = jest.mocked(unsaveSearch)

describe('useSearchHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>)
    mockGetItem.mockResolvedValue(null)
    mockFetchRecentSearchHistory.mockResolvedValue([
      { query: 'ramen', last_searched_at: '2026-06-01T00:00:00Z', search_count: 2 },
    ])
    mockFetchRecentSearchHistoryFallback.mockResolvedValue([])
    mockFetchSavedSearches.mockResolvedValue([])
    mockSaveSearch.mockResolvedValue('ramen')
    mockUnsaveSearch.mockResolvedValue()
  })

  it('loads saved searches after auth is available', async () => {
    mockFetchSavedSearches.mockResolvedValue(['omakase CBD', 'cheap ramen'])

    const { result } = renderHook(() => useSearchHistory())

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual(['omakase CBD', 'cheap ramen'])
    })
    expect(mockFetchSavedSearches).toHaveBeenCalledWith('user-1', 50)
  })

  it('dedupes case and spacing variants when saving', async () => {
    mockFetchSavedSearches.mockResolvedValue(['Ramen'])
    mockSaveSearch.mockResolvedValue('RAMEN')
    const { result } = renderHook(() => useSearchHistory())

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual(['Ramen'])
    })

    act(() => {
      result.current.saveSearch('  RAMEN  ')
    })

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual(['RAMEN'])
    })
    expect(mockSaveSearch).toHaveBeenCalledWith('RAMEN')
    expect(analytics.saveSearch).toHaveBeenCalledWith('user-1', 'RAMEN')
  })

  it('unsaves without touching recent search history', async () => {
    mockFetchSavedSearches.mockResolvedValue(['ramen'])
    const { result } = renderHook(() => useSearchHistory())

    await waitFor(() => {
      expect(result.current.recentSearches).toEqual(['ramen'])
      expect(result.current.savedSearches).toEqual(['ramen'])
    })

    act(() => {
      result.current.unsaveSearch('ramen')
    })

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual([])
      expect(result.current.recentSearches).toEqual(['ramen'])
    })
    expect(mockUnsaveSearch).toHaveBeenCalledWith('ramen')
  })

  it('derives dismissed cuisine affinities from dismissed queries', async () => {
    const { result } = renderHook(() => useSearchHistory())

    await waitFor(() => {
      expect(result.current.recentSearches).toEqual(['ramen'])
    })

    act(() => {
      result.current.dismissSearch('ramen')
    })

    await waitFor(() => {
      expect(result.current.dismissedCuisines.japanese).toBeGreaterThan(0)
    })
    expect(analytics.dismissSearchQuery).toHaveBeenCalledWith('user-1', 'ramen')
  })

  it('rolls back optimistic save state when persistence fails', async () => {
    let rejectSave: (error: Error) => void = () => {}
    mockSaveSearch.mockReturnValue(new Promise((_resolve, reject) => {
      rejectSave = reject
    }))
    const { result } = renderHook(() => useSearchHistory())

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual([])
    })

    act(() => {
      result.current.saveSearch('udon')
    })
    expect(result.current.savedSearches).toEqual(['udon'])

    await act(async () => {
      rejectSave(new Error('offline'))
    })

    await waitFor(() => {
      expect(result.current.savedSearches).toEqual([])
    })
  })
})
