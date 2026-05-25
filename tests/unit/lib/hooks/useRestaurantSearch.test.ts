import { act, renderHook } from '@testing-library/react-native'
import { useRestaurantSearch } from '@/lib/hooks/useRestaurantSearch'
import type { Prediction } from '@/lib/services/restaurants'
import {
  fetchNearbyRestaurants,
  fetchPlaceDetails,
  fetchPredictions,
  searchRestaurantsByText,
  upsertRestaurant,
} from '@/lib/services/restaurants'

jest.mock('@/lib/hooks/useUserLocation', () => ({
  useUserLocation: () => ({ coords: { lat: -33.87, lng: 151.21 } }),
}))
jest.mock('@/lib/services/restaurants', () => ({
  fetchNearbyRestaurants: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  fetchPredictions: jest.fn(),
  searchRestaurantsByText: jest.fn(),
  upsertRestaurant: jest.fn(),
}))

const mockFetchNearbyRestaurants = jest.mocked(fetchNearbyRestaurants)
const mockFetchPlaceDetails = jest.mocked(fetchPlaceDetails)
const mockFetchPredictions = jest.mocked(fetchPredictions)
const mockSearchRestaurantsByText = jest.mocked(searchRestaurantsByText)
const mockUpsertRestaurant = jest.mocked(upsertRestaurant)

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

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    place_id: 'place-1',
    description: 'Ramen Bar',
    structured_formatting: {
      main_text: 'Ramen Bar',
      secondary_text: 'Sydney',
    },
    source: 'google',
    score: 1,
    ...overrides,
  }
}

describe('useRestaurantSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockFetchNearbyRestaurants.mockResolvedValue([])
    mockFetchPredictions.mockResolvedValue([])
    mockSearchRestaurantsByText.mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('ranks and deduplicates local matches ahead of provider predictions', async () => {
    const local = prediction({
      source: 'rekkus',
      score: 3,
      dbDetails: { restaurantId: 'rest-1', lat: -33.87, lng: 151.21, address: '1 Food Street' },
    })
    mockSearchRestaurantsByText.mockResolvedValueOnce([local])
    mockFetchPredictions.mockResolvedValueOnce([prediction({ place_id: 'google-duplicate' })])

    const { result } = renderHook(() =>
      useRestaurantSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.predictions).toEqual([local])
  })

  it('selects a local match without paid detail lookup or upsert', async () => {
    const onPlaceSelected = jest.fn()
    const local = prediction({
      source: 'rekkus',
      dbDetails: { restaurantId: 'rest-1', lat: -33.87, lng: 151.21, address: '1 Food Street' },
    })
    const { result } = renderHook(() =>
      useRestaurantSearch({ cuisineType: 'Japanese', onPlaceSelected })
    )

    await act(async () => {
      await result.current.selectPrediction(local)
    })

    expect(onPlaceSelected).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 'rest-1' }))
    expect(mockFetchPlaceDetails).not.toHaveBeenCalled()
    expect(mockUpsertRestaurant).not.toHaveBeenCalled()
  })

  it('upserts and returns a selected provider match', async () => {
    const onPlaceSelected = jest.fn()
    mockFetchPlaceDetails.mockResolvedValueOnce({
      name: 'Ramen Bar',
      formatted_address: '1 Food Street',
      geometry: { location: { lat: -33.87, lng: 151.21 } },
    } as never)
    mockUpsertRestaurant.mockResolvedValueOnce('rest-1')
    const { result } = renderHook(() =>
      useRestaurantSearch({ cuisineType: 'Japanese', onPlaceSelected })
    )

    await act(async () => {
      await result.current.selectPrediction(prediction())
    })

    expect(mockUpsertRestaurant).toHaveBeenCalledWith(expect.anything(), 'place-1', 'Japanese')
    expect(onPlaceSelected).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 'rest-1' }))
  })

  it('drops pending prediction and nearby results when cleared', async () => {
    const predictionRequest = deferred<Prediction[]>()
    const nearbyRequest = deferred<Prediction[]>()
    mockSearchRestaurantsByText.mockReturnValueOnce(predictionRequest.promise)
    mockFetchPredictions.mockResolvedValueOnce([])
    mockFetchNearbyRestaurants.mockReturnValueOnce(nearbyRequest.promise)
    const { result } = renderHook(() =>
      useRestaurantSearch({ cuisineType: '', onPlaceSelected: jest.fn() })
    )

    act(() => {
      result.current.handleSearchChange('ramen')
      result.current.onSearchFocus()
    })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    act(() => result.current.clearSearch())
    await act(async () => {
      predictionRequest.resolve([prediction()])
      nearbyRequest.resolve([prediction({ place_id: 'nearby' })])
      await Promise.resolve()
    })

    expect(result.current.predictions).toEqual([])
    expect(result.current.nearbyPlaces).toEqual([])
  })

  it('does not continue provider selection after unmount', async () => {
    const pendingDetail = deferred<Awaited<ReturnType<typeof fetchPlaceDetails>>>()
    const onPlaceSelected = jest.fn()
    mockFetchPlaceDetails.mockReturnValueOnce(pendingDetail.promise)
    const { result, unmount } = renderHook(() =>
      useRestaurantSearch({ cuisineType: 'Japanese', onPlaceSelected })
    )

    let selection: Promise<void> | undefined
    act(() => {
      selection = result.current.selectPrediction(prediction())
    })
    unmount()
    await act(async () => {
      pendingDetail.resolve({
        name: 'Ramen Bar',
        formatted_address: '1 Food Street',
        geometry: { location: { lat: -33.87, lng: 151.21 } },
      } as never)
      await selection
    })

    expect(mockUpsertRestaurant).not.toHaveBeenCalled()
    expect(onPlaceSelected).not.toHaveBeenCalled()
  })
})
