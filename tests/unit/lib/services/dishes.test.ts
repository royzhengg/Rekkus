import { fetchDishDetail } from '@/lib/services/dishes'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

const mockFrom = jest.mocked(supabase.from)

describe('fetchDishDetail', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes a canonical dish and its linked restaurant', async () => {
    const overrideTypes = jest.fn().mockResolvedValue({
      data: {
        id: 'dish-1',
        name: 'Tonkotsu ramen',
        cuisine_type: 'Japanese',
        place_id: 'restaurant-1',
        places: {
          id: 'restaurant-1',
          name: 'Noodle Bar',
          address: '1 Main St',
          google_place_id: 'google-1',
          latitude: -33.87,
          longitude: 151.21,
        },
      },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockReturnValue({ overrideTypes }),
        }),
      }),
    } as never)

    await expect(fetchDishDetail('dish-1')).resolves.toEqual({
      id: 'dish-1',
      name: 'Tonkotsu ramen',
      cuisineType: 'Japanese',
      placeId: 'restaurant-1',
      place: {
        id: 'restaurant-1',
        name: 'Noodle Bar',
        address: '1 Main St',
        googlePlaceId: 'google-1',
        lat: -33.87,
        lng: 151.21,
      },
    })
  })

  it('returns null when no canonical dish row is present', async () => {
    const overrideTypes = jest.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockReturnValue({ overrideTypes }),
        }),
      }),
    } as never)

    await expect(fetchDishDetail('missing')).resolves.toBeNull()
  })
})
