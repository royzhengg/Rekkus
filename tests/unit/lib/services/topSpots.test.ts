import { fetchTopSpotsWithDetails } from '@/lib/services/topSpots'

const mockOrder = jest.fn()
const mockEq = jest.fn(() => ({ order: mockOrder }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

describe('topSpots service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [], error: null })
  })

  it('does not expose raw Google photo refs as renderable profile place URLs', async () => {
    mockOrder.mockResolvedValue({
      data: [{
        position: 1,
        place_id: 'place-1',
        places: {
          id: 'place-1',
          name: 'Wally & Ossies Pizza',
          address: '288 Beamish St',
          latitude: -33.9,
          longitude: 151.1,
          google_place_id: 'google-place-1',
          google_photo_refs: ['raw-google-ref'],
        },
      }],
      error: null,
    })

    await expect(fetchTopSpotsWithDetails('user-1')).resolves.toEqual([{
      id: 'place-1',
      name: 'Wally & Ossies Pizza',
      address: '288 Beamish St',
      lat: -33.9,
      lng: 151.1,
      placeId: 'google-place-1',
      photoUrl: null,
      postCount: 0,
      avgFoodRating: null,
      lastPostedAt: null,
    }])
  })
})
