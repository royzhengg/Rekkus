import type { ProfileRestaurant } from '@/features/profile/profileIdentity'
import { hydrateProfileRestaurantPhotos } from '@/features/profile/profilePhotos'
import {
  fetchRestaurantProviderDetail,
  fetchRestaurantRow,
  fetchRestaurantRowByPlaceId,
  getRestaurantDisplayPhoto,
  getRestaurantProviderPhotoUrl,
} from '@/lib/services/restaurants'

jest.mock('@/lib/services/restaurants', () => ({
  fetchRestaurantRow: jest.fn(),
  fetchRestaurantRowByPlaceId: jest.fn(),
  getRestaurantDisplayPhoto: jest.fn(),
  fetchRestaurantProviderDetail: jest.fn(),
  getRestaurantProviderPhotoUrl: jest.fn(),
}))

const mockFetchRestaurantRow = jest.mocked(fetchRestaurantRow)
const mockFetchRestaurantRowByPlaceId = jest.mocked(fetchRestaurantRowByPlaceId)
const mockGetRestaurantDisplayPhoto = jest.mocked(getRestaurantDisplayPhoto)
const mockFetchRestaurantProviderDetail = jest.mocked(fetchRestaurantProviderDetail)
const mockGetRestaurantProviderPhotoUrl = jest.mocked(getRestaurantProviderPhotoUrl)

function restaurant(overrides: Partial<ProfileRestaurant>): ProfileRestaurant {
  return {
    id: 'restaurant-1',
    name: 'Henry Lees',
    address: 'Hart St',
    lat: null,
    lng: null,
    placeId: null,
    photoUrl: null,
    reviewCount: 1,
    avgFoodRating: 5,
    lastReviewedAt: null,
    ...overrides,
  }
}

describe('profile restaurant photo hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchRestaurantRow.mockResolvedValue(null)
    mockFetchRestaurantRowByPlaceId.mockResolvedValue(null)
    mockGetRestaurantDisplayPhoto.mockResolvedValue(null)
    mockFetchRestaurantProviderDetail.mockResolvedValue(null)
    mockGetRestaurantProviderPhotoUrl.mockReturnValue('')
  })

  it('keeps existing first-party profile photos without service lookups', async () => {
    const hydrated = await hydrateProfileRestaurantPhotos([
      restaurant({ photoUrl: 'https://example.com/review.jpg' }),
    ])

    expect(hydrated[0]?.photoUrl).toBe('https://example.com/review.jpg')
    expect(mockFetchRestaurantRow).not.toHaveBeenCalled()
    expect(mockGetRestaurantDisplayPhoto).not.toHaveBeenCalled()
  })

  it('hydrates missing photos through restaurant rows and cached provider refs', async () => {
    mockFetchRestaurantRow.mockResolvedValue({
      id: 'restaurant-1',
      google_place_id: 'place-1',
      google_photo_refs: ['provider-ref'],
    })
    mockGetRestaurantDisplayPhoto.mockResolvedValue('https://example.com/provider.jpg')

    const hydrated = await hydrateProfileRestaurantPhotos([
      restaurant({ id: 'restaurant-1', placeId: 'place-1' }),
    ])

    expect(mockGetRestaurantDisplayPhoto).toHaveBeenCalledWith('restaurant-1', ['provider-ref'])
    expect(mockFetchRestaurantRowByPlaceId).not.toHaveBeenCalled()
    expect(hydrated[0]?.photoUrl).toBe('https://example.com/provider.jpg')
  })

  it('falls back to place-id row lookup when the restaurant id is not local', async () => {
    mockFetchRestaurantRowByPlaceId.mockResolvedValue({
      id: 'restaurant-2',
      google_place_id: 'place-2',
      google_photo_refs: ['provider-ref-2'],
    })
    mockGetRestaurantDisplayPhoto.mockResolvedValue('https://example.com/provider2.jpg')

    const hydrated = await hydrateProfileRestaurantPhotos([
      restaurant({ id: 'place-2', placeId: 'place-2' }),
    ])

    expect(mockFetchRestaurantRowByPlaceId).toHaveBeenCalledWith('place-2')
    expect(mockGetRestaurantDisplayPhoto).toHaveBeenCalledWith('restaurant-2', ['provider-ref-2'])
    expect(hydrated[0]?.photoUrl).toBe('https://example.com/provider2.jpg')
  })

  it('falls back to Google Places API when no cached photo refs exist', async () => {
    mockFetchRestaurantRow.mockResolvedValue({
      id: 'restaurant-3',
      google_place_id: 'place-3',
      google_photo_refs: [],
    })
    mockGetRestaurantDisplayPhoto.mockResolvedValue(null)
    mockFetchRestaurantProviderDetail.mockResolvedValue({ photos: [{ photo_reference: 'fresh-ref' }] })
    mockGetRestaurantProviderPhotoUrl.mockReturnValue('https://maps.googleapis.com/photo?ref=fresh-ref')

    const hydrated = await hydrateProfileRestaurantPhotos([
      restaurant({ id: 'restaurant-3', placeId: 'place-3' }),
    ])

    expect(mockFetchRestaurantProviderDetail).toHaveBeenCalledWith('place-3', 'photos')
    expect(mockGetRestaurantProviderPhotoUrl).toHaveBeenCalledWith('fresh-ref')
    expect(hydrated[0]?.photoUrl).toBe('https://maps.googleapis.com/photo?ref=fresh-ref')
  })
})
