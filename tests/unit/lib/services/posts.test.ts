import { extractPostRow, fetchPostLikes, mapRowToPost, savePost, type SavedPostRow } from '@/lib/services/posts'
import type { RawPost } from '@/lib/services/posts/types'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
}))

jest.mock('@/lib/services/notifications', () => ({
  notify: jest.fn(),
}))

const mockFrom = jest.mocked(supabase.from)

function makeRow(overrides: Partial<SavedPostRow> = {}): SavedPostRow {
  return {
    id: 'post-1',
    user_id: 'user-1',
    caption: 'Great ramen',
    food_rating: 5,
    vibe_rating: 4,
    cost_rating: 3,
    cuisine_type: 'Japanese',
    must_order: 'Tonkotsu ramen',
    dish_tags: null,
    place_id: null,
    dish_id: null,
    photo_url: null,
    media: [],
    taste_verdict: null,
    value_verdict: null,
    occasion_tags: [],
    username: 'royzheng',
    full_name: 'Roy Zheng',
    avatar_url: null,
    place_name: 'Noodle Bar',
    place_address: null,
    place_lat: null,
    place_lng: null,
    place_google_id: null,
    created_at: '2024-01-01T00:00:00Z',
    last_edited_at: null,
    edit_count: null,
    ...overrides,
  }
}

describe('mapRowToPost', () => {
  it('maps basic fields from the row', () => {
    const post = mapRowToPost(makeRow(), 0)
    expect(post.id).toBe(1)
    expect(post.dbId).toBe('post-1')
    expect(post.creator).toBe('royzheng')
    expect(post.food).toBe(5)
    expect(post.vibe).toBe(4)
    expect(post.cost).toBe(3)
    expect(post.location).toBe('Noodle Bar')
    expect(post.cuisine_type).toBe('Japanese')
    expect(post.mustOrder).toBe('Tonkotsu ramen')
    expect(post.createdAt).toBe('2024-01-01T00:00:00Z')
  })

  it('uses index+1 as the numeric id', () => {
    expect(mapRowToPost(makeRow(), 0).id).toBe(1)
    expect(mapRowToPost(makeRow(), 4).id).toBe(5)
  })

  it('falls back to empty string when caption is null', () => {
    const post = mapRowToPost(makeRow({ caption: null }), 0)
    expect(post.title).toBe('')
    expect(post.body).toBe('')
  })

  it('defaults food/vibe/cost ratings to 0 when null', () => {
    const post = mapRowToPost(makeRow({ food_rating: null, vibe_rating: null, cost_rating: null }), 0)
    expect(post.food).toBe(0)
    expect(post.vibe).toBe(0)
    expect(post.cost).toBe(0)
  })

  it('picks processed_url over raw url for image media', () => {
    const row = makeRow({
      media: [{
        url: 'https://example.com/raw.jpg',
        processed_url: 'https://example.com/processed.jpg',
        media_type: 'image',
      }],
    })
    const post = mapRowToPost(row, 0)
    expect(post.imageUrl).toBe('https://example.com/processed.jpg')
  })

  it('uses image thumbnail_url as the post cover when processed_url is unavailable', () => {
    const row = makeRow({
      media: [{
        url: 'https://example.com/raw.jpg',
        processed_url: null,
        thumbnail_url: 'https://example.com/thumb.jpg',
        media_type: 'image',
      }],
    })
    const post = mapRowToPost(row, 0)
    expect(post.imageUrl).toBe('https://example.com/thumb.jpg')
  })

  it('uses raw image url as the post cover when processed and thumbnail URLs are unavailable', () => {
    const row = makeRow({
      media: [{
        url: 'https://example.com/raw.jpg',
        processed_url: null,
        thumbnail_url: null,
        media_type: 'image',
      }],
    })
    const post = mapRowToPost(row, 0)
    expect(post.imageUrl).toBe('https://example.com/raw.jpg')
  })

  it('uses video thumbnail as the saved-library cover when no image media exists', () => {
    const row = makeRow({
      media: [{
        url: 'https://example.com/raw.mp4',
        processed_url: 'https://example.com/processed.mp4',
        thumbnail_url: 'https://example.com/video-thumb.jpg',
        media_type: 'video',
      }],
    })
    const post = mapRowToPost(row, 0)
    expect(post.imageUrl).toBe('https://example.com/video-thumb.jpg')
    expect(post.videoUrl).toBe('https://example.com/processed.mp4')
  })

  it('falls back to photo_url when media array is empty', () => {
    const row = makeRow({ media: [], photo_url: 'https://example.com/legacy.jpg' })
    const post = mapRowToPost(row, 0)
    expect(post.imageUrl).toBe('https://example.com/legacy.jpg')
  })

  it('maps processed video media and Rekkus verdict fields', () => {
    const row = makeRow({
      media: [{
        url: 'https://example.com/raw.mp4',
        processed_url: 'https://example.com/processed.mp4',
        media_type: 'video',
      }],
      taste_verdict: 'must_order',
      value_verdict: 'great_value',
      occasion_tags: ['date_night'],
    })

    const post = mapRowToPost(row, 0)
    expect(post.videoUrl).toBe('https://example.com/processed.mp4')
    expect(post.mediaType).toBe('video')
    expect(post.tasteVerdict).toBe('must_order')
    expect(post.valueVerdict).toBe('great_value')
    expect(post.occasionTags).toEqual(['date_night'])
  })
})

describe('extractPostRow', () => {
  function makeRawPost(overrides: Partial<RawPost> = {}): RawPost {
    return {
      id: 'post-1',
      user_id: 'user-1',
      deleted_at: null,
      caption: 'Great ramen',
      food_rating: 5,
      vibe_rating: 4,
      cost_rating: 3,
      cuisine_type: 'Japanese',
      must_order: 'Tonkotsu ramen',
      dish_id: null,
      dish_tags: null,
      place_id: null,
      taste_verdict: null,
      value_verdict: null,
      occasion_tags: [],
      created_at: '2024-01-01T00:00:00Z',
      last_edited_at: null,
      edit_count: null,
      users: { username: 'royzheng', full_name: 'Roy Zheng', avatar_url: null },
      post_photos: [],
      places: null,
      ...overrides,
    }
  }

  it('preserves missing processed_url so thumbnail_url can become the cover', () => {
    const row = extractPostRow(makeRawPost({
      post_photos: [{
        id: 'photo-1',
        url: 'https://example.com/raw.jpg',
        deleted_at: null,
        media_type: 'image',
        processed_url: null,
        thumbnail_url: 'https://example.com/thumb.jpg',
        mime_type: 'image/jpeg',
        duration_ms: null,
        width: 1000,
        height: 750,
        size_bytes: 1234,
        processing_status: 'ready',
        processing_error: null,
        order_index: 0,
      }],
    }))

    expect(row).not.toBeNull()
    if (!row) return
    expect(row.media[0]?.processed_url).toBeNull()
    expect(mapRowToPost(row, 0).imageUrl).toBe('https://example.com/thumb.jpg')
  })

  it('hydrates seeded mock post cover rows into post imageUrl', () => {
    const seededCoverUrl = 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=1050&fit=crop&auto=format'
    const row = extractPostRow(makeRawPost({
      id: '11000000-0000-0000-0000-000000000006',
      caption: 'Sydney brunch spot with zero wait — and the eggs benny are elite',
      post_photos: [{
        id: 'photo-6',
        url: seededCoverUrl,
        deleted_at: null,
        media_type: 'image',
        processed_url: seededCoverUrl,
        thumbnail_url: seededCoverUrl,
        mime_type: null,
        duration_ms: null,
        width: null,
        height: null,
        size_bytes: null,
        processing_status: 'ready',
        processing_error: null,
        order_index: 0,
      }],
    }))

    expect(row).not.toBeNull()
    if (!row) return
    expect(mapRowToPost(row, 0).imageUrl).toBe(seededCoverUrl)
  })
})

describe('fetchPostLikes', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns the count from supabase', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 42, data: null, error: null }),
      }),
    } as never)

    const count = await fetchPostLikes('post-1')
    expect(count).toBe(42)
    expect(mockFrom).toHaveBeenCalledWith('likes')
  })

  it('returns 0 when count is null', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: null, data: null, error: null }),
      }),
    } as never)

    const count = await fetchPostLikes('post-1')
    expect(count).toBe(0)
  })
})

describe('savePost', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects when Supabase cannot persist a save', async () => {
    mockFrom.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: new Error('Network request failed') }),
    } as never)

    await expect(savePost('post-1', 'user-1')).rejects.toThrow('Network request failed')
  })
})
