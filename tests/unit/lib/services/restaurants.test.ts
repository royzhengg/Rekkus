import {
  mapRestaurantRpcRowToPrediction,
  distanceGroupForPrediction,
  searchRestaurantsByText,
  fetchNearbyRestaurants,
  recordRestaurantProviderCache,
} from '@/lib/services/restaurants'

// ── module mocks ──────────────────────────────────────────────────────────────

const mockRpc = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/lib/services/googlePlaces', () => ({
  buildGooglePlacePhotoUrl: jest.fn(),
  fetchPlaceAutocompleteJson: jest.fn(),
  fetchPlaceDetailsJson: jest.fn(),
  fetchPlaceTextSearchJson: jest.fn(),
}))

jest.mock('@/lib/services/boundaryTelemetry', () => ({
  reportInvalidBoundary: jest.fn(),
}))

// ── row factories ─────────────────────────────────────────────────────────────

const baseRow = {
  id: 'restaurant-1',
  name: 'Golden Dumpling',
  google_place_id: 'ChIJxxx',
  latitude: -33.8688,
  longitude: 151.2093,
  cuisine_type: 'Chinese',
  city: 'Sydney',
  address: '1 Market Street',
  suburb: 'CBD',
  rank: 5,
}

// ── mapRestaurantRpcRowToPrediction ───────────────────────────────────────────

describe('mapRestaurantRpcRowToPrediction', () => {
  it('maps basic fields to Prediction shape', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow)
    expect(result.place_id).toBe('ChIJxxx')
    expect(result.description).toBe('Golden Dumpling')
    expect(result.source).toBe('rekkus')
    expect(result.structured_formatting.main_text).toBe('Golden Dumpling')
    expect(result.dbDetails?.restaurantId).toBe('restaurant-1')
    expect(result.dbDetails?.lat).toBe(-33.8688)
    expect(result.dbDetails?.lng).toBe(151.2093)
  })

  it('falls back to row id when google_place_id is null', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, google_place_id: null })
    expect(result.place_id).toBe('restaurant-1')
  })

  it('includes distance in secondary text when user location is provided', () => {
    const userLocation = { lat: -33.87, lng: 151.21 }
    const result = mapRestaurantRpcRowToPrediction(baseRow, userLocation)
    expect(result.distanceKm).toBeDefined()
    expect(result.structured_formatting.secondary_text).toMatch(/m$|km$/)
  })

  it('omits distanceKm when user location is not provided', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow)
    expect(result.distanceKm).toBeUndefined()
  })

  it('adds rank offset to score', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, rank: 3 })
    expect(result.score).toBe(13)
  })

  it('handles null latitude/longitude gracefully', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, latitude: null, longitude: null })
    expect(result.dbDetails?.lat).toBe(0)
    expect(result.dbDetails?.lng).toBe(0)
  })
})

// ── distanceGroupForPrediction ────────────────────────────────────────────────

describe('distanceGroupForPrediction', () => {
  it('returns "nearby" for <= 2km', () => {
    expect(distanceGroupForPrediction(0.5)).toBe('nearby')
    expect(distanceGroupForPrediction(2)).toBe('nearby')
  })

  it('returns "city" for 2–50km', () => {
    expect(distanceGroupForPrediction(10)).toBe('city')
  })

  it('returns "state" for 50–250km', () => {
    expect(distanceGroupForPrediction(100)).toBe('state')
  })

  it('returns "country" for 250–4000km', () => {
    expect(distanceGroupForPrediction(1000)).toBe('country')
  })

  it('returns "worldwide" for > 4000km', () => {
    expect(distanceGroupForPrediction(5000)).toBe('worldwide')
  })

  it('returns "nearby" for rekkus source with no distance', () => {
    expect(distanceGroupForPrediction(undefined, 'rekkus')).toBe('nearby')
  })

  it('returns "worldwide" for google source with no distance', () => {
    expect(distanceGroupForPrediction(undefined, 'google')).toBe('worldwide')
  })
})

// ── searchRestaurantsByText ───────────────────────────────────────────────────

describe('searchRestaurantsByText', () => {
  it('calls search_restaurants_full_text RPC and maps results', async () => {
    mockRpc.mockResolvedValue({ data: [baseRow], error: null })
    const results = await searchRestaurantsByText('dumpling', 8)
    expect(results).toHaveLength(1)
    expect(results[0]?.description).toBe('Golden Dumpling')
    expect(mockRpc).toHaveBeenCalledWith('search_restaurants_full_text', expect.objectContaining({
      query_text: 'dumpling',
      max_results: 8,
    }))
  })

  it('includes location params when user location is provided', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const location = { lat: -33.87, lng: 151.21 }
    await searchRestaurantsByText('ramen', 5, location)
    expect(mockRpc).toHaveBeenCalledWith('search_restaurants_full_text', expect.objectContaining({
      near_lat: location.lat,
      near_lng: location.lng,
    }))
  })

  it('returns empty array when RPC returns no data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const results = await searchRestaurantsByText('xyz')
    expect(results).toHaveLength(0)
  })
})

// ── fetchNearbyRestaurants ────────────────────────────────────────────────────

describe('fetchNearbyRestaurants', () => {
  it('calls restaurants_within_radius with correct params', async () => {
    mockRpc.mockResolvedValue({ data: [baseRow], error: null })
    const location = { lat: -33.87, lng: 151.21 }
    const results = await fetchNearbyRestaurants(location, 1)
    expect(results).toHaveLength(1)
    expect(mockRpc).toHaveBeenCalledWith('restaurants_within_radius', expect.objectContaining({
      p_lat: -33.87,
      p_lng: 151.21,
      p_radius_metres: 1000,
      p_max_results: 8,
    }))
  })
})

// ── recordRestaurantProviderCache (30-day TTL) ────────────────────────────────

describe('recordRestaurantProviderCache', () => {
  it('calls record_restaurant_provider_snapshot with stale_at ~30 days from now', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const before = Date.now()
    await recordRestaurantProviderCache(
      'restaurant-1',
      'google_places',
      'ChIJxxx',
      {
        name: 'Golden Dumpling',
        formatted_address: '1 Market Street, Sydney',
        geometry: { location: { lat: -33.87, lng: 151.21 } },
        photos: [],
      } as never
    )
    const after = Date.now()

    expect(mockRpc).toHaveBeenCalledWith(
      'record_restaurant_provider_snapshot',
      expect.objectContaining({ p_restaurant_id: 'restaurant-1' })
    )

    const call = mockRpc.mock.calls.find(c => c[0] === 'record_restaurant_provider_snapshot')
    const staleAt = new Date(call?.[1]?.p_stale_at as string).getTime()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    expect(staleAt).toBeGreaterThanOrEqual(before + thirtyDays - 1000)
    expect(staleAt).toBeLessThanOrEqual(after + thirtyDays + 1000)
  })
})
