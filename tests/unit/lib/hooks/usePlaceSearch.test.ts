import { act, renderHook } from '@testing-library/react-native'
import { analytics } from '@/lib/analytics'
import { usePlaceSearch } from '@/lib/hooks/usePlaceSearch'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import type { Prediction } from '@/lib/services/places'
import {
  fetchFoodCategoryPredictions,
  fetchNearbyPlaces,
  fetchPlaceDetails,
  fetchPredictions,
  searchPlacesByText,
  upsertPlaceStubs,
  upsertPlace,
} from '@/lib/services/places'
import { classifyRestaurantTagIntent } from '@/lib/utils/searchIntent'

const mockBaseLocation = {
  coords: { lat: -33.87, lng: 151.21 },
  label: null,
  status: 'granted' as const,
  error: null,
  loading: false,
  requestLocation: jest.fn(),
  setManualLocation: jest.fn(),
  clearLocation: jest.fn(),
}

jest.mock('@/lib/hooks/useUserLocation', () => ({
  useUserLocation: jest.fn(() => mockBaseLocation),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    placeSearchTermEntered: jest.fn(),
    placeSearchZeroResults: jest.fn(),
    placeSelected: jest.fn(),
    placeTaggingGoogleFallbackUsed: jest.fn(),
    placeTaggingGoogleFallbackSuppressed: jest.fn(),
  },
}))

const mockUseUserLocation = jest.mocked(useUserLocation)
jest.mock('@/lib/services/places', () => ({
  distanceGroupForPrediction: jest.fn((distanceKm: number | undefined, source?: string) => {
    if (distanceKm === undefined) return source === 'rekkus' ? 'nearby' : 'worldwide'
    if (distanceKm <= 2) return 'nearby'
    if (distanceKm <= 50) return 'city'
    if (distanceKm <= 250) return 'state'
    if (distanceKm <= 4000) return 'country'
    return 'worldwide'
  }),
  fetchFoodCategoryPredictions: jest.fn(),
  fetchNearbyPlaces: jest.fn(),
  fetchPlaceDetails: jest.fn(),
  fetchPredictions: jest.fn(),
  searchPlacesByText: jest.fn(),
  upsertPlaceStubs: jest.fn().mockResolvedValue(undefined),
  upsertPlace: jest.fn(),
}))

const mockFetchFoodCategoryPredictions = jest.mocked(fetchFoodCategoryPredictions)
const mockFetchNearbyPlaces = jest.mocked(fetchNearbyPlaces)
const mockFetchPlaceDetails = jest.mocked(fetchPlaceDetails)
const mockFetchPredictions = jest.mocked(fetchPredictions)
const mockSearchPlacesByText = jest.mocked(searchPlacesByText)
jest.mocked(upsertPlaceStubs)
const mockUpsertPlace = jest.mocked(upsertPlace)
const mockPlaceSearchTermEntered = jest.mocked(analytics.placeSearchTermEntered)
const mockPlaceSearchZeroResults = jest.mocked(analytics.placeSearchZeroResults)
const mockPlaceSelected = jest.mocked(analytics.placeSelected)

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

function localPrediction(index: number, overrides: Partial<Prediction> = {}): Prediction {
  return prediction({
    place_id: `local-${index}`,
    description: `Local Ramen ${index}`,
    structured_formatting: {
      main_text: `Local Ramen ${index}`,
      secondary_text: 'Sydney',
    },
    source: 'rekkus',
    score: 10 - index,
    dbDetails: {
      placeId: `rest-${index}`,
      lat: -33.87,
      lng: 151.21,
      address: `${index} Food Street`,
    },
    ...overrides,
  })
}

describe('usePlaceSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockUseUserLocation.mockReturnValue(mockBaseLocation)
    mockFetchFoodCategoryPredictions.mockResolvedValue([])
    mockFetchNearbyPlaces.mockResolvedValue([])
    mockFetchPredictions.mockResolvedValue([])
    mockSearchPlacesByText.mockResolvedValue([])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('passes user coordinates to searchPlacesByText', async () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('beef'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockSearchPlacesByText).toHaveBeenCalledWith(
      'beef',
      12,
      { lat: -33.87, lng: 151.21 }
    )
  })

  it('passes user coordinates to fetchFoodCategoryPredictions for food terms', async () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('beef'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(mockFetchFoodCategoryPredictions).toHaveBeenCalledWith('beef', { lat: -33.87, lng: 151.21 })
  })

  it('suppresses unbounded Google fallback for ambiguous food queries without location', async () => {
    mockUseUserLocation.mockReturnValue({ ...mockBaseLocation, coords: null, status: 'idle' as const })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('pork'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockSearchPlacesByText).toHaveBeenCalledWith('pork', 12, null)
    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(analytics.placeTaggingGoogleFallbackSuppressed).toHaveBeenCalledWith(
      'user-1',
      'pork',
      'dish_or_menu_item',
      'ambiguous_food_without_location',
      'none'
    )
  })

  it('classifies cafe as a venue category and suppresses Google without location', async () => {
    mockUseUserLocation.mockReturnValue({ ...mockBaseLocation, coords: null, status: 'idle' as const })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Cafe', userId: 'user-1', onPlaceSelected: jest.fn() })
    )

    act(() => result.current.handleSearchChange('cafe'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(classifyRestaurantTagIntent('cafe').kind).toBe('venue_category')
    expect(result.current.placeTagIntent.kind).toBe('venue_category')
    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(analytics.placeTaggingGoogleFallbackSuppressed).toHaveBeenCalledWith(
      'user-1',
      'cafe',
      'venue_category',
      'ambiguous_food_without_location',
      'none'
    )
  })

  it('uses Text Search (not Autocomplete) for food_dish intent when coordinates are available', async () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Cafe', userId: 'user-1', onPlaceSelected: jest.fn() })
    )

    act(() => result.current.handleSearchChange('cafe'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(classifyRestaurantTagIntent('cafe').kind).toBe('venue_category')
    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(mockFetchFoodCategoryPredictions).toHaveBeenCalledWith('cafe', { lat: -33.87, lng: 151.21 })
    expect(analytics.placeTaggingGoogleFallbackUsed).toHaveBeenCalledWith(
      'user-1',
      'cafe',
      'venue_category',
      'bounded_locality',
      true,
      'gps'
    )
  })

  it('uses Text Search for food category "Noodles" with location and shows results', async () => {
    const noodlePlace = {
      place_id: 'noodle-box-1',
      description: 'Noodle Box',
      structured_formatting: { main_text: 'Noodle Box', secondary_text: '12 Burwood Rd, Burwood NSW' },
      types: ['restaurant'],
      source: 'google' as const,
      score: 0,
      distanceKm: 0.5,
      distanceGroup: 'nearby' as const,
    }
    mockFetchFoodCategoryPredictions.mockResolvedValueOnce([noodlePlace])
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: '', userId: 'user-1', onPlaceSelected: jest.fn() })
    )

    act(() => result.current.handleSearchChange('Noodles'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(mockFetchFoodCategoryPredictions).toHaveBeenCalledWith('Noodles', { lat: -33.87, lng: 151.21 })
    expect(result.current.predictions).toHaveLength(1)
    expect(result.current.predictions[0]!.place_id).toBe('noodle-box-1')
  })

  it('classifies omelette as dish intent and suppresses unbounded Google fallback', async () => {
    mockUseUserLocation.mockReturnValue({ ...mockBaseLocation, coords: null, status: 'idle' as const })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: '', userId: 'user-1', onPlaceSelected: jest.fn() })
    )

    act(() => result.current.handleSearchChange('omelette'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(classifyRestaurantTagIntent('omelette').kind).toBe('dish_or_menu_item')
    expect(result.current.placeTagIntent.kind).toBe('dish_or_menu_item')
    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(analytics.placeTaggingGoogleFallbackSuppressed).toHaveBeenCalledWith(
      'user-1',
      'omelette',
      'dish_or_menu_item',
      'ambiguous_food_without_location',
      'none'
    )
  })

  it('allows unbounded Google fallback for strong restaurant-name queries without location', async () => {
    mockUseUserLocation.mockReturnValue({ ...mockBaseLocation, coords: null, status: 'idle' as const })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('Din Tai Fung'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockFetchPredictions).toHaveBeenCalledWith('Din Tai Fung', null)
    expect(analytics.placeTaggingGoogleFallbackUsed).toHaveBeenCalledWith(
      'user-1',
      'Din Tai Fung',
      'restaurant_name',
      'unbounded_restaurant_name',
      false,
      'none'
    )
  })

  it('does not emit search term analytics for queries shorter than 2 chars', async () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('r'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockPlaceSearchTermEntered).not.toHaveBeenCalled()
    expect(mockSearchPlacesByText).not.toHaveBeenCalled()
  })

  it('emits search term analytics after debounce for 2+ chars', async () => {
    mockSearchPlacesByText.mockResolvedValueOnce([prediction()])
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange(' ramen '))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockPlaceSearchTermEntered).toHaveBeenCalledWith('user-1', 'ramen')
    expect(mockSearchPlacesByText).toHaveBeenCalledWith(
      'ramen',
      12,
      { lat: -33.87, lng: 151.21 }
    )
  })

  it('tops up thin local results with bounded Google fallback', async () => {
    mockSearchPlacesByText.mockResolvedValueOnce([localPrediction(1), localPrediction(2)])
    mockFetchFoodCategoryPredictions.mockResolvedValueOnce([
      prediction({
        place_id: 'google-1',
        structured_formatting: { main_text: 'Provider Ramen', secondary_text: 'Sydney' },
      }),
    ])
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(mockFetchFoodCategoryPredictions).toHaveBeenCalledWith('ramen', { lat: -33.87, lng: 151.21 })
    expect(analytics.placeTaggingGoogleFallbackUsed).toHaveBeenCalledWith(
      'user-1',
      'ramen',
      'dish_or_menu_item',
      'thin_local_results',
      true,
      'gps'
    )
    expect(result.current.predictions.map(item => item.place_id)).toEqual([
      'local-1',
      'local-2',
      'google-1',
    ])
  })

  it('does not call Google when local results are already healthy', async () => {
    mockSearchPlacesByText.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, index) => localPrediction(index + 1))
    )
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockFetchPredictions).not.toHaveBeenCalled()
    expect(result.current.predictions).toHaveLength(6)
  })

  it('keeps local rows ahead of provider rows when topping up', async () => {
    mockSearchPlacesByText.mockResolvedValueOnce([localPrediction(1, { score: 0 })])
    mockFetchFoodCategoryPredictions.mockResolvedValueOnce([
      prediction({
        place_id: 'google-high',
        score: 99,
        structured_formatting: { main_text: 'Provider High Score', secondary_text: 'Sydney' },
      }),
    ])
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.predictions.map(item => item.place_id)).toEqual([
      'local-1',
      'google-high',
    ])
  })

  it('caps merged place tag results at 10', async () => {
    mockSearchPlacesByText.mockResolvedValueOnce([localPrediction(1)])
    mockFetchFoodCategoryPredictions.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, index) =>
        prediction({
          place_id: `google-${index + 1}`,
          structured_formatting: {
            main_text: `Provider Ramen ${index + 1}`,
            secondary_text: 'Sydney',
          },
        })
      )
    )
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.predictions).toHaveLength(10)
    expect(result.current.predictions[0]?.place_id).toBe('local-1')
  })

  it('emits zero-results analytics after an empty merged search', async () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', userId: 'user-1', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('xyzzy'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockPlaceSearchZeroResults).toHaveBeenCalledWith('user-1', 'xyzzy')
  })

  it('ranks and deduplicates local matches ahead of provider predictions', async () => {
    const local = prediction({
      source: 'rekkus',
      score: 3,
      dbDetails: { placeId: 'rest-1', lat: -33.87, lng: 151.21, address: '1 Food Street' },
    })
    mockSearchPlacesByText.mockResolvedValueOnce([local])
    mockFetchFoodCategoryPredictions.mockResolvedValueOnce([prediction({ place_id: 'google-duplicate' })])

    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.predictions).toEqual([
      expect.objectContaining({
        ...local,
        distanceGroup: 'nearby',
      }),
    ])
  })

  it('groups merged predictions by distance tier while preserving order inside each tier', async () => {
    const city = prediction({
      place_id: 'city',
      description: 'City Ramen',
      structured_formatting: {
        main_text: 'City Ramen',
        secondary_text: 'Sydney',
      },
      source: 'rekkus',
      score: 1,
      distanceKm: 20,
      dbDetails: { placeId: 'city-rest', lat: -33.9, lng: 151.2, address: 'City St' },
    })
    const nearby = prediction({
      place_id: 'nearby',
      description: 'Nearby Ramen',
      structured_formatting: {
        main_text: 'Nearby Ramen',
        secondary_text: 'Sydney',
      },
      source: 'rekkus',
      score: 0.5,
      distanceKm: 1,
      dbDetails: { placeId: 'near-rest', lat: -33.87, lng: 151.21, address: 'Near St' },
    })
    mockSearchPlacesByText.mockResolvedValueOnce([city, nearby])

    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    act(() => result.current.handleSearchChange('ramen'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(result.current.predictions.map(item => item.place_id)).toEqual([
      'nearby',
      'city',
    ])
    expect(result.current.predictions.map(item => item.distanceGroup)).toEqual([
      'nearby',
      'city',
    ])
  })

  it('selects a local match without paid detail lookup or upsert', async () => {
    const onPlaceSelected = jest.fn()
    const local = prediction({
      source: 'rekkus',
      dbDetails: { placeId: 'rest-1', lat: -33.87, lng: 151.21, address: '1 Food Street' },
    })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected })
    )

    await act(async () => {
      await result.current.selectPrediction(local)
    })

    expect(onPlaceSelected).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'rest-1' }))
    expect(mockPlaceSelected).toHaveBeenCalledWith(
      null,
      'place-1',
      'prediction',
      'rest-1',
      'Japanese'
    )
    expect(mockFetchPlaceDetails).not.toHaveBeenCalled()
    expect(mockUpsertPlace).not.toHaveBeenCalled()
  })

  it('upserts and returns a selected provider match', async () => {
    const onPlaceSelected = jest.fn()
    mockFetchPlaceDetails.mockResolvedValueOnce({
      name: 'Ramen Bar',
      formatted_address: '1 Food Street',
      geometry: { location: { lat: -33.87, lng: 151.21 } },
    } as never)
    mockUpsertPlace.mockResolvedValueOnce('rest-1')
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected })
    )

    await act(async () => {
      await result.current.selectPrediction(prediction(), 'nearby')
    })

    expect(mockUpsertPlace).toHaveBeenCalledWith(expect.anything(), 'place-1', 'Japanese')
    expect(onPlaceSelected).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'rest-1' }))
    expect(mockPlaceSelected).toHaveBeenCalledWith(
      null,
      'place-1',
      'nearby',
      'rest-1',
      'Japanese'
    )
  })

  it('drops pending prediction and nearby results when cleared', async () => {
    const predictionRequest = deferred<Prediction[]>()
    const nearbyRequest = deferred<Prediction[]>()
    mockSearchPlacesByText.mockReturnValueOnce(predictionRequest.promise)
    mockFetchPredictions.mockResolvedValueOnce([])
    mockFetchNearbyPlaces.mockReturnValueOnce(nearbyRequest.promise)
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: '', onPlaceSelected: jest.fn() })
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

  it('exposes locationConstrained true when coords are available', () => {
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    expect(result.current.locationConstrained).toBe(true)
  })

  it('exposes locationConstrained false when no coords', () => {
    mockUseUserLocation.mockReturnValue({ ...mockBaseLocation, coords: null, status: 'denied' as const })
    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )
    expect(result.current.locationConstrained).toBe(false)
  })

  it('does not continue provider selection after unmount', async () => {
    const pendingDetail = deferred<Awaited<ReturnType<typeof fetchPlaceDetails>>>()
    const onPlaceSelected = jest.fn()
    mockFetchPlaceDetails.mockReturnValueOnce(pendingDetail.promise)
    const { result, unmount } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected })
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

    expect(mockUpsertPlace).not.toHaveBeenCalled()
    expect(onPlaceSelected).not.toHaveBeenCalled()
  })

  it('fires a search with fresh coords when requestLocationAndSearch resolves', async () => {
    const freshCoords = { lat: -33.87, lng: 151.21 }
    const mockRequestLocation = jest.fn().mockResolvedValue(freshCoords)
    mockUseUserLocation.mockReturnValue({
      ...mockBaseLocation,
      coords: null,
      status: 'idle' as const,
      requestLocation: mockRequestLocation,
    })

    const { result } = renderHook(() =>
      usePlaceSearch({ cuisineType: 'Japanese', onPlaceSelected: jest.fn() })
    )

    // User types a query before tapping the button
    act(() => result.current.handleSearchChange('Cafe'))
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    const callsBefore = mockSearchPlacesByText.mock.calls.length

    // User taps "Use current location" — requestLocationAndSearch awaits GPS then re-searches
    await act(async () => {
      await result.current.requestLocationAndSearch()
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(mockSearchPlacesByText.mock.calls.length).toBeGreaterThan(callsBefore)
    const lastCall = mockSearchPlacesByText.mock.calls[mockSearchPlacesByText.mock.calls.length - 1]!
    expect(lastCall[0]).toBe('Cafe')
    expect(lastCall[2]).toEqual(freshCoords)
  })
})
