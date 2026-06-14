import { mapRowToDish } from '@/lib/services/dishes'
import { mapRestaurantRpcRowToPrediction } from '@/lib/services/restaurants'
import { mapRowToFollowListUser } from '@/lib/services/users'

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }))

// ── mapRowToDish ──────────────────────────────────────────────────────────────

describe('mapRowToDish', () => {
  it('maps a full dish row to DishDetail', () => {
    const result = mapRowToDish({
      id: 'dish-1',
      name: 'Tonkatsu',
      cuisine_type: 'Japanese',
      restaurant_id: 'rest-1',
      restaurants: {
        id: 'rest-1',
        name: 'Ginza',
        address: '1 Main St',
        google_place_id: 'place-abc',
        latitude: 35.6,
        longitude: 139.7,
      },
    })
    expect(result).toEqual({
      id: 'dish-1',
      name: 'Tonkatsu',
      restaurantId: 'rest-1',
      cuisineType: 'Japanese',
      restaurant: {
        id: 'rest-1',
        name: 'Ginza',
        address: '1 Main St',
        placeId: 'place-abc',
        lat: 35.6,
        lng: 139.7,
      },
    })
  })

  it('handles null optional fields gracefully', () => {
    const result = mapRowToDish({
      id: 'dish-2',
      name: 'Edamame',
      cuisine_type: null,
      restaurant_id: null,
      restaurants: null,
    })
    expect(result.id).toBe('dish-2')
    expect(result.cuisineType).toBeUndefined()
    expect(result.restaurantId).toBeUndefined()
    expect(result.restaurant).toBeUndefined()
  })

  it('omits restaurant fields that are null in the row', () => {
    const result = mapRowToDish({
      id: 'dish-3',
      name: 'Ramen',
      cuisine_type: null,
      restaurant_id: 'rest-2',
      restaurants: {
        id: 'rest-2',
        name: 'Noodle Bar',
        address: null,
        google_place_id: null,
        latitude: null,
        longitude: null,
      },
    })
    expect(result.restaurant).toEqual({ id: 'rest-2', name: 'Noodle Bar' })
    expect(result.restaurant?.address).toBeUndefined()
    expect(result.restaurant?.placeId).toBeUndefined()
    expect(result.restaurant?.lat).toBeUndefined()
  })
})

// ── mapRowToFollowListUser ────────────────────────────────────────────────────

describe('mapRowToFollowListUser', () => {
  it('maps a valid user row', () => {
    const result = mapRowToFollowListUser({
      id: 'user-1',
      username: 'alice',
      full_name: 'Alice Smith',
      avatar_url: 'https://example.com/alice.jpg',
    })
    expect(result).toEqual({
      id: 'user-1',
      username: 'alice',
      full_name: 'Alice Smith',
      avatar_url: 'https://example.com/alice.jpg',
    })
  })

  it('returns null for missing id', () => {
    expect(mapRowToFollowListUser({ username: 'alice' })).toBeNull()
  })

  it('returns null for missing username', () => {
    expect(mapRowToFollowListUser({ id: 'user-1' })).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(mapRowToFollowListUser(null)).toBeNull()
    expect(mapRowToFollowListUser('alice')).toBeNull()
    expect(mapRowToFollowListUser(42)).toBeNull()
  })

  it('sets full_name and avatar_url to null when absent', () => {
    const result = mapRowToFollowListUser({ id: 'user-2', username: 'bob' })
    expect(result?.full_name).toBeNull()
    expect(result?.avatar_url).toBeNull()
  })
})

// ── mapRestaurantRpcRowToPrediction ───────────────────────────────────────────

const baseRow = {
  id: 'rest-1',
  name: 'The Fox',
  google_place_id: 'place-xyz',
  latitude: 51.5,
  longitude: -0.12,
  cuisine_type: 'British',
  city: 'London',
  address: '10 Downing St',
}

describe('mapRestaurantRpcRowToPrediction', () => {
  it('maps a row to a Prediction with source rekkus', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow, null)
    expect(result.place_id).toBe('place-xyz')
    expect(result.description).toBe('The Fox')
    expect(result.source).toBe('rekkus')
    expect(result.structured_formatting.main_text).toBe('The Fox')
    expect(result.dbDetails?.restaurantId).toBe('rest-1')
    expect(result.dbDetails?.lat).toBe(51.5)
    expect(result.dbDetails?.lng).toBe(-0.12)
    expect(result.dbDetails?.cuisineType).toBe('British')
    expect(result.dbDetails?.city).toBe('London')
  })

  it('falls back to id when google_place_id is null', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, google_place_id: null }, null)
    expect(result.place_id).toBe('rest-1')
  })

  it('includes distance when userLocation is provided', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow, { lat: 51.5, lng: -0.12 })
    expect(result.distanceKm).toBeDefined()
    expect(result.distanceKm).toBeCloseTo(0, 1)
  })

  it('omits distanceKm when userLocation is null', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow, null)
    expect(result.distanceKm).toBeUndefined()
  })

  it('includes distance label in secondary text when location provided', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow, { lat: 51.5, lng: -0.12 })
    expect(result.structured_formatting.secondary_text).toContain('m')
  })

  it('adds rank to base score of 10', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, rank: 5 }, null)
    expect(result.score).toBe(15)
  })

  it('uses score 10 when rank is absent', () => {
    const result = mapRestaurantRpcRowToPrediction(baseRow, null)
    expect(result.score).toBe(10)
  })

  it('uses suburb in secondary text when provided', () => {
    const result = mapRestaurantRpcRowToPrediction({ ...baseRow, suburb: 'Mayfair' }, null)
    expect(result.structured_formatting.secondary_text).toContain('Mayfair')
    expect(result.dbDetails?.suburb).toBe('Mayfair')
  })
})
