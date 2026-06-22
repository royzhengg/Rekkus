import {
  cachePlacePhotoRefs,
  fetchPlaceProviderDetail,
  getPlaceDisplayPhoto,
  getPlaceProviderPhotoUrl,
} from '@/lib/services/places'
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

jest.mock('@/lib/services/places', () => ({
  cachePlacePhotoRefs: jest.fn(),
  fetchPlaceProviderDetail: jest.fn(),
  getPlaceDisplayPhoto: jest.fn(),
  getPlaceProviderPhotoUrl: jest.fn(),
}))

const mockCachePlacePhotoRefs = jest.mocked(cachePlacePhotoRefs)
const mockFetchPlaceProviderDetail = jest.mocked(fetchPlaceProviderDetail)
const mockGetPlaceDisplayPhoto = jest.mocked(getPlaceDisplayPhoto)
const mockGetPlaceProviderPhotoUrl = jest.mocked(getPlaceProviderPhotoUrl)

const freshUpdatedAt = new Date().toISOString()
const staleUpdatedAt = '2000-01-01T00:00:00.000Z'

describe('topSpots service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockCachePlacePhotoRefs.mockResolvedValue(undefined)
    mockFetchPlaceProviderDetail.mockResolvedValue(null)
    mockGetPlaceDisplayPhoto.mockResolvedValue(null)
    mockGetPlaceProviderPhotoUrl.mockReturnValue('')
  })

  it('hydrates cached Google photo refs into renderable profile place URLs', async () => {
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
          updated_at: freshUpdatedAt,
        },
      }],
      error: null,
    })
    mockGetPlaceDisplayPhoto.mockResolvedValue('https://example.com/display.jpg')

    await expect(fetchTopSpotsWithDetails('user-1')).resolves.toEqual([{
      id: 'place-1',
      name: 'Wally & Ossies Pizza',
      address: '288 Beamish St',
      lat: -33.9,
      lng: 151.1,
      placeId: 'google-place-1',
      photoUrl: 'https://example.com/display.jpg',
      postCount: 0,
      avgFoodRating: null,
      lastPostedAt: null,
    }])
    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-1', ['raw-google-ref'])
    expect(mockFetchPlaceProviderDetail).not.toHaveBeenCalled()
    expect(mockGetPlaceProviderPhotoUrl).not.toHaveBeenCalled()
  })

  it('refreshes stale cached provider refs before returning a top spot photo URL', async () => {
    mockOrder.mockResolvedValue({
      data: [{
        position: 1,
        place_id: 'place-1',
        places: {
          id: 'place-1',
          name: 'Italian Street Kitchen Parramatta',
          address: 'Shop 1/180 George St',
          latitude: -33.8,
          longitude: 151,
          google_place_id: 'google-place-1',
          google_photo_refs: ['stale-ref'],
          updated_at: staleUpdatedAt,
        },
      }],
      error: null,
    })
    mockFetchPlaceProviderDetail.mockResolvedValue({ photos: [{ photo_reference: 'fresh-ref' }] })
    mockGetPlaceProviderPhotoUrl.mockReturnValue('https://maps.googleapis.com/photo?ref=fresh-ref')

    const result = await fetchTopSpotsWithDetails('user-1')

    expect(result[0]?.photoUrl).toBe('https://maps.googleapis.com/photo?ref=fresh-ref')
    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-1', [])
    expect(mockFetchPlaceProviderDetail).toHaveBeenCalledWith('google-place-1', 'photos')
    expect(mockCachePlacePhotoRefs).toHaveBeenCalledWith('place-1', ['fresh-ref'])
    expect(mockGetPlaceProviderPhotoUrl).toHaveBeenCalledWith('fresh-ref')
  })

  it('fetches and caches fresh provider photo refs when cached display photos are missing', async () => {
    mockOrder.mockResolvedValue({
      data: [{
        position: 1,
        place_id: 'place-1',
        places: {
          id: 'place-1',
          name: 'Italian Street Kitchen Parramatta',
          address: 'Shop 1/180 George St',
          latitude: -33.8,
          longitude: 151,
          google_place_id: 'google-place-1',
          google_photo_refs: [],
          updated_at: freshUpdatedAt,
        },
      }],
      error: null,
    })
    mockFetchPlaceProviderDetail.mockResolvedValue({ photos: [{ photo_reference: 'fresh-ref' }] })
    mockGetPlaceProviderPhotoUrl.mockReturnValue('https://maps.googleapis.com/photo?ref=fresh-ref')

    const result = await fetchTopSpotsWithDetails('user-1')

    expect(result[0]?.photoUrl).toBe('https://maps.googleapis.com/photo?ref=fresh-ref')
    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-1', [])
    expect(mockFetchPlaceProviderDetail).toHaveBeenCalledWith('google-place-1', 'photos')
    expect(mockCachePlacePhotoRefs).toHaveBeenCalledWith('place-1', ['fresh-ref'])
    expect(mockGetPlaceProviderPhotoUrl).toHaveBeenCalledWith('fresh-ref')
  })

  it('leaves photoUrl empty when no first-party, cached, or provider photo exists', async () => {
    mockOrder.mockResolvedValue({
      data: [{
        position: 1,
        place_id: 'place-1',
        places: {
          id: 'place-1',
          name: 'No Photo Cafe',
          address: null,
          latitude: null,
          longitude: null,
          google_place_id: 'google-place-1',
          google_photo_refs: [],
          updated_at: freshUpdatedAt,
        },
      }],
      error: null,
    })
    mockFetchPlaceProviderDetail.mockResolvedValue({ photos: [] })

    const result = await fetchTopSpotsWithDetails('user-1')

    expect(result[0]?.photoUrl).toBeNull()
    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-1', [])
    expect(mockFetchPlaceProviderDetail).toHaveBeenCalledWith('google-place-1', 'photos')
    expect(mockCachePlacePhotoRefs).not.toHaveBeenCalled()
  })
})
