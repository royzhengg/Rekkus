import { renderHook, waitFor } from '@testing-library/react-native'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import {
  fetchPopularPlacesByIds,
  fetchTrendingPlaceClicks,
  fetchTrendingPostEvents,
  fetchTrendingSearches,
} from '@/lib/services/search'

jest.mock('@/lib/services/search', () => ({
  fetchPopularPlacesByIds: jest.fn(),
  fetchTrendingPlaceClicks: jest.fn(),
  fetchTrendingPostEvents: jest.fn(),
  fetchTrendingSearches: jest.fn(),
}))

const mockFetchPopularPlacesByIds = jest.mocked(fetchPopularPlacesByIds)
const mockFetchTrendingPlaceClicks = jest.mocked(fetchTrendingPlaceClicks)
const mockFetchTrendingPostEvents = jest.mocked(fetchTrendingPostEvents)
const mockFetchTrendingSearches = jest.mocked(fetchTrendingSearches)

const place = {
  id: 'rest-1',
  name: 'Ramen Bar',
  address: '1 Food Street',
  city: 'Melbourne',
  cuisine_type: 'Japanese',
  google_place_id: 'google-1',
  latitude: -37.81,
  longitude: 144.96,
  google_rating: 4.5,
  google_review_count: 100,
}

describe('useTrendingData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchTrendingSearches.mockResolvedValue([{ query: 'ramen' }])
    mockFetchTrendingPlaceClicks.mockResolvedValue([{ entity_id: 'rest-1' }])
    mockFetchTrendingPostEvents.mockResolvedValue([{ event_type: 'post_save', entity_id: 'post-1' }])
    mockFetchPopularPlacesByIds.mockResolvedValue([place])
  })

  it('refetches trending data when nearCity changes', async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useTrendingData>, { nearCity: string }>(
      ({ nearCity }) => useTrendingData(nearCity),
      { initialProps: { nearCity: 'Melbourne' } }
    )

    await waitFor(() => {
      expect(result.current.trendingSearches).toEqual(['ramen'])
    })

    mockFetchTrendingSearches.mockResolvedValueOnce([{ query: 'sushi' }])
    mockFetchTrendingPlaceClicks.mockResolvedValueOnce([{ entity_id: 'rest-2' }])
    mockFetchTrendingPostEvents.mockResolvedValueOnce([{ event_type: 'post_like', entity_id: 'post-2' }])
    mockFetchPopularPlacesByIds.mockResolvedValueOnce([{ ...place, id: 'rest-2', name: 'Sushi Den' }])

    rerender({ nearCity: 'Sydney' })

    await waitFor(() => {
      expect(result.current.trendingSearches).toEqual(['sushi'])
    })
    expect(mockFetchTrendingSearches).toHaveBeenLastCalledWith(6, 'Sydney')
    expect(result.current.trendingPlaceIds).toEqual(['rest-2'])
    expect(result.current.popularPlaces).toEqual([{ ...place, id: 'rest-2', name: 'Sushi Den' }])
  })

  it('clears stale trending data after a refresh failure', async () => {
    const { result, rerender } = renderHook<ReturnType<typeof useTrendingData>, { nearCity: string }>(
      ({ nearCity }) => useTrendingData(nearCity),
      { initialProps: { nearCity: 'Melbourne' } }
    )

    await waitFor(() => {
      expect(result.current.trendingSearches).toEqual(['ramen'])
    })

    mockFetchTrendingSearches.mockRejectedValueOnce(new Error('db unavailable'))

    rerender({ nearCity: 'Sydney' })

    await waitFor(() => {
      expect(result.current.trendingSearches).toEqual([])
    })
    expect(result.current.trendingPlaceIds).toEqual([])
    expect(result.current.trendingPostIds).toEqual([])
    expect(result.current.popularPlaces).toEqual([])
  })
})
