import type { ProfilePlace } from '@/features/profile/profileIdentity'
import { hydrateProfilePlacePhotos } from '@/features/profile/profilePhotos'
import {
  fetchPlaceProviderDetail,
  fetchPlaceRow,
  fetchPlaceRowByGooglePlaceId,
  getPlaceDisplayPhoto,
  getPlaceProviderPhotoUrl,
  cachePlacePhotoRefs,
} from '@/lib/services/places'

jest.mock('@/lib/services/places', () => ({
  fetchPlaceRow: jest.fn(),
  fetchPlaceRowByGooglePlaceId: jest.fn(),
  getPlaceDisplayPhoto: jest.fn(),
  fetchPlaceProviderDetail: jest.fn(),
  getPlaceProviderPhotoUrl: jest.fn(),
  cachePlacePhotoRefs: jest.fn(),
}))

const mockFetchPlaceRow = jest.mocked(fetchPlaceRow)
const mockFetchPlaceRowByPlaceId = jest.mocked(fetchPlaceRowByGooglePlaceId)
const mockGetPlaceDisplayPhoto = jest.mocked(getPlaceDisplayPhoto)
const mockFetchProviderDetail = jest.mocked(fetchPlaceProviderDetail)
const mockGetProviderPhotoUrl = jest.mocked(getPlaceProviderPhotoUrl)
const mockCachePlacePhotoRefs = jest.mocked(cachePlacePhotoRefs)

function place(overrides: Partial<ProfilePlace>): ProfilePlace {
  return {
    id: 'place-1',
    name: 'Henry Lees',
    address: 'Hart St',
    lat: null,
    lng: null,
    placeId: null,
    photoUrl: null,
    postCount: 1,
    avgFoodRating: 5,
    lastPostedAt: null,
    ...overrides,
  }
}

describe('profile place photo hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPlaceRow.mockResolvedValue(null)
    mockFetchPlaceRowByPlaceId.mockResolvedValue(null)
    mockGetPlaceDisplayPhoto.mockResolvedValue(null)
    mockFetchProviderDetail.mockResolvedValue(null)
    mockGetProviderPhotoUrl.mockReturnValue('')
    mockCachePlacePhotoRefs.mockResolvedValue(undefined)
  })

  it('keeps existing first-party profile photos without service lookups', async () => {
    const hydrated = await hydrateProfilePlacePhotos([
      place({ photoUrl: 'https://example.com/review.jpg' }),
    ])

    expect(hydrated[0]?.photoUrl).toBe('https://example.com/review.jpg')
    expect(mockFetchPlaceRow).not.toHaveBeenCalled()
    expect(mockGetPlaceDisplayPhoto).not.toHaveBeenCalled()
  })

  it('hydrates missing photos through place rows and cached provider refs', async () => {
    mockFetchPlaceRow.mockResolvedValue({
      id: 'place-1',
      google_place_id: 'gplace-1',
      google_photo_refs: ['provider-ref'],
      primary_photo_source: 'google',
    })
    mockGetPlaceDisplayPhoto.mockResolvedValue('https://example.com/provider.jpg')

    const hydrated = await hydrateProfilePlacePhotos([
      place({ id: 'place-1', placeId: 'gplace-1' }),
    ])

    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-1', ['provider-ref'])
    expect(mockFetchPlaceRowByPlaceId).not.toHaveBeenCalled()
    expect(hydrated[0]?.photoUrl).toBe('https://example.com/provider.jpg')
  })

  it('falls back to google-place-id row lookup when the place id is not local', async () => {
    mockFetchPlaceRowByPlaceId.mockResolvedValue({
      id: 'place-2',
      google_place_id: 'gplace-2',
      google_photo_refs: ['provider-ref-2'],
      primary_photo_source: 'google',
    })
    mockGetPlaceDisplayPhoto.mockResolvedValue('https://example.com/provider2.jpg')

    const hydrated = await hydrateProfilePlacePhotos([
      place({ id: 'gplace-2', placeId: 'gplace-2' }),
    ])

    expect(mockFetchPlaceRowByPlaceId).toHaveBeenCalledWith('gplace-2')
    expect(mockGetPlaceDisplayPhoto).toHaveBeenCalledWith('place-2', ['provider-ref-2'])
    expect(hydrated[0]?.photoUrl).toBe('https://example.com/provider2.jpg')
  })

  it('falls back to Google Places API and caches fresh refs when no cached photo refs exist', async () => {
    mockFetchPlaceRow.mockResolvedValue({
      id: 'place-3',
      google_place_id: 'gplace-3',
      google_photo_refs: [],
      primary_photo_source: 'google',
    })
    mockGetPlaceDisplayPhoto.mockResolvedValue(null)
    mockFetchProviderDetail.mockResolvedValue({ photos: [{ photo_reference: 'fresh-ref' }] })
    mockGetProviderPhotoUrl.mockReturnValue('https://maps.googleapis.com/photo?ref=fresh-ref')

    const hydrated = await hydrateProfilePlacePhotos([
      place({ id: 'place-3', placeId: 'gplace-3' }),
    ])

    expect(mockFetchProviderDetail).toHaveBeenCalledWith('gplace-3', 'photos')
    expect(mockCachePlacePhotoRefs).toHaveBeenCalledWith('place-3', ['fresh-ref'])
    expect(mockGetProviderPhotoUrl).toHaveBeenCalledWith('fresh-ref')
    expect(hydrated[0]?.photoUrl).toBe('https://maps.googleapis.com/photo?ref=fresh-ref')
  })

  it('leaves photoUrl empty when no first-party, cached, or provider photo exists', async () => {
    mockFetchPlaceRow.mockResolvedValue({
      id: 'place-4',
      google_place_id: 'gplace-4',
      google_photo_refs: [],
      primary_photo_source: 'google',
    })
    mockGetPlaceDisplayPhoto.mockResolvedValue(null)
    mockFetchProviderDetail.mockResolvedValue({ photos: [] })

    const hydrated = await hydrateProfilePlacePhotos([
      place({ id: 'place-4', placeId: 'gplace-4' }),
    ])

    expect(hydrated[0]?.photoUrl).toBeNull()
    expect(mockCachePlacePhotoRefs).not.toHaveBeenCalled()
  })
})
