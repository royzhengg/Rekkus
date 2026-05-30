import { fetchPostLikes, mapRowToPost, savePost, type SavedPostRow } from '@/lib/services/posts'
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
    restaurant_id: null,
    dish_id: null,
    photo_url: null,
    media: [],
    taste_verdict: null,
    value_verdict: null,
    occasion_tags: [],
    username: 'royzheng',
    full_name: 'Roy Zheng',
    avatar_url: null,
    restaurant_name: 'Noodle Bar',
    restaurant_address: null,
    restaurant_lat: null,
    restaurant_lng: null,
    restaurant_place_id: null,
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
