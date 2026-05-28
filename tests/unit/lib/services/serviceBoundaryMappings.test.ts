import { mapAlertRow } from '@/lib/services/alerts'
import { normalizeSavedLocations } from '@/lib/services/savedLocations'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/services/settings'

jest.mock('@/lib/supabase', () => ({
  supabase: {},
}))

describe('service-boundary normalisation', () => {
  it('defaults legacy saved locations to want_to_try while preserving joined details', () => {
    expect(normalizeSavedLocations([{
      id: 'save-1',
      restaurant_id: 'restaurant-1',
      created_at: '2026-05-25T00:00:00.000Z',
      restaurants: {
        name: 'Noodle House',
        address: null,
        latitude: -33.8,
        longitude: 151.2,
        google_place_id: 'place-1',
      },
    }])).toEqual([{
      id: 'save-1',
      restaurant_id: 'restaurant-1',
      created_at: '2026-05-25T00:00:00.000Z',
      save_status: 'want_to_try',
      restaurants: {
        name: 'Noodle House',
        address: null,
        latitude: -33.8,
        longitude: 151.2,
        google_place_id: 'place-1',
      },
    }])
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
