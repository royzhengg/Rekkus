import { mapAlertRow } from '@/lib/services/alerts'
import { fetchSavedPlacesForUser, normalizeSavedPlaces } from '@/lib/services/savedPlaces'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/services/settings'

const mockLimit = jest.fn()
const mockOrder = jest.fn(() => ({ limit: mockLimit }))
const mockEq = jest.fn(() => ({ order: mockOrder }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect, update: mockUpdate }))
const mockGetPlaceDisplayPhoto = jest.fn()
const mockFetchPlaceProviderDetail = jest.fn()
const mockGetPlaceProviderPhotoUrl = jest.fn((ref: string) => `https://example.com/google-photo/${ref}`)

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

jest.mock('@/lib/services/places/google', () => ({
  fetchPlaceProviderDetail: (placeId: string, fields: string) => mockFetchPlaceProviderDetail(placeId, fields),
  getPlaceProviderPhotoUrl: (ref: string) => mockGetPlaceProviderPhotoUrl(ref),
}))

jest.mock('@/lib/services/places/photos', () => ({
  getPlaceDisplayPhoto: (placeId?: string | null, refs?: string[]) => mockGetPlaceDisplayPhoto(placeId, refs),
}))

describe('service-boundary normalisation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLimit.mockResolvedValue({ data: [], error: null })
    mockUpdateEq.mockResolvedValue({ data: null, error: null })
    mockGetPlaceDisplayPhoto.mockResolvedValue(null)
    mockFetchPlaceProviderDetail.mockResolvedValue(null)
    mockGetPlaceProviderPhotoUrl.mockImplementation((ref: string) => `https://example.com/google-photo/${ref}`)
  })

  it('normalizes saved places without intent status while preserving joined details and cached photo URLs', () => {
    expect(normalizeSavedPlaces([{
      id: 'save-1',
      place_id: 'restaurant-1',
      created_at: '2026-05-25T00:00:00.000Z',
      places: {
        name: 'Noodle House',
        address: null,
        latitude: -33.8,
        longitude: 151.2,
        google_place_id: 'place-1',
        google_photo_refs: ['photo-ref-1'],
      },
    }])).toEqual([{
      id: 'save-1',
      place_id: 'restaurant-1',
      created_at: '2026-05-25T00:00:00.000Z',
      places: {
        name: 'Noodle House',
        address: null,
        latitude: -33.8,
        longitude: 151.2,
        google_place_id: 'place-1',
        photoUrl: 'https://example.com/google-photo/photo-ref-1',
      },
    }])
  })

  it('hydrates saved place thumbnails from first-party display photos before provider fallback', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{
        id: 'save-1',
        place_id: 'place-1',
        created_at: '2026-05-25T00:00:00.000Z',
        places: {
          name: 'Noodle House',
          address: null,
          latitude: -33.8,
          longitude: 151.2,
          google_place_id: 'google-1',
          google_photo_refs: [],
        },
      }],
      error: null,
    })
    mockGetPlaceDisplayPhoto.mockResolvedValueOnce('https://example.com/first-party.jpg')

    await expect(fetchSavedPlacesForUser('user-1', { providerPhotoFallbackLimit: 12 })).resolves.toMatchObject([{
      place_id: 'place-1',
      places: { photoUrl: 'https://example.com/first-party.jpg' },
    }])
    expect(mockFetchPlaceProviderDetail).not.toHaveBeenCalled()
  })

  it('uses bounded provider fallback for saved place thumbnails and caches discovered refs', async () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({
      id: `save-${index + 1}`,
      place_id: `place-${index + 1}`,
      created_at: '2026-05-25T00:00:00.000Z',
      places: {
        name: `Place ${index + 1}`,
        address: null,
        latitude: -33.8,
        longitude: 151.2,
        google_place_id: `google-${index + 1}`,
        google_photo_refs: [],
      },
    }))
    mockLimit.mockResolvedValueOnce({ data: rows, error: null })
    mockFetchPlaceProviderDetail.mockImplementation(async (placeId: string) => ({
      photos: [{ photo_reference: `fresh-${placeId}` }],
    }))

    const savedPlaces = await fetchSavedPlacesForUser('user-1', { providerPhotoFallbackLimit: 12 })

    expect(savedPlaces[0]?.places?.photoUrl).toBe('https://example.com/google-photo/fresh-google-1')
    expect(savedPlaces[11]?.places?.photoUrl).toBe('https://example.com/google-photo/fresh-google-12')
    expect(savedPlaces[12]?.places?.photoUrl).toBeNull()
    expect(mockFetchPlaceProviderDetail).toHaveBeenCalledTimes(12)
    expect(mockUpdate).toHaveBeenCalledWith({ google_photo_refs: ['fresh-google-1'] })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'place-1')
  })

  it('normalises settings and defaults legacy autoplay while rejecting unknown theme modes', () => {
    expect(normalizeSettings({
      ...DEFAULT_SETTINGS,
      notif_likes: false,
      theme_mode: 'sepia',
      autoplay_videos: 'yes',
    })).toEqual({
      ...DEFAULT_SETTINGS,
      notif_likes: false,
      theme_mode: 'system',
    })
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, autoplay_videos: false }).autoplay_videos).toBe(false)
  })

  it('maps related actors and reply ids for alert rows', () => {
    expect(mapAlertRow('comment_reply', {
      id: 'comment-1',
      created_at: '2026-05-25T00:00:00.000Z',
      post_id: 'post-1',
      actor: [{ username: 'alice', full_name: 'Alice Example' }],
    })).toEqual({
      id: 'reply-comment-1',
      type: 'comment_reply',
      actorUsername: 'alice',
      actorName: 'Alice Example',
      postId: 'post-1',
      createdAt: '2026-05-25T00:00:00.000Z',
    })
  })
})
