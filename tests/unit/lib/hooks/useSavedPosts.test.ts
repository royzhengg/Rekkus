import { renderHook, waitFor } from '@testing-library/react-native'
import { useSavedPosts } from '@/lib/hooks/useSavedPosts'
import { readOfflineCache, writeOfflineCache } from '@/lib/services/offlineCache'
import { fetchSavedPostsPage, mapRowToPost, type SavedPostRow } from '@/lib/services/posts'
import type { Post } from '@/types/domain'

jest.mock('expo-router', () => {
  const { useEffect } = require('react') as { useEffect: (...args: unknown[]) => void }
  return {
    useFocusEffect: jest.fn((cb: () => (() => void) | void) => useEffect(cb, [cb])),
  }
})

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: jest.fn(() => ({ syncEpoch: 0 })),
}))

jest.mock('@/lib/services/offlineCache', () => ({
  readOfflineCache: jest.fn(),
  writeOfflineCache: jest.fn(),
}))

jest.mock('@/lib/services/posts', () => ({
  fetchSavedPostsPage: jest.fn(),
  mapRowToPost: jest.fn(),
}))

const mockReadOfflineCache = jest.mocked(readOfflineCache)
const mockWriteOfflineCache = jest.mocked(writeOfflineCache)
const mockFetchSavedPostsPage = jest.mocked(fetchSavedPostsPage)
const mockMapRowToPost = jest.mocked(mapRowToPost)

const savedPost: Post = {
  id: 1,
  dbId: 'post-1',
  title: 'Saved post',
  body: 'Saved post',
  creator: 'royzheng',
  initials: 'RZ',
  avatarBg: 'white',
  avatarColor: 'black',
  likes: '0',
  imgKey: 'warm',
  imageUrl: 'https://example.com/cover.jpg',
  tall: false,
  tags: [],
  location: 'Noodle Bar',
}

const savedPostRow: SavedPostRow = {
  id: 'post-1',
  user_id: 'user-1',
  caption: 'Saved post',
  food_rating: null,
  vibe_rating: null,
  cost_rating: null,
  cuisine_type: null,
  must_order: null,
  dish_id: null,
  dish_tags: null,
  place_id: null,
  photo_url: null,
  media: [],
  taste_verdict: null,
  value_verdict: null,
  occasion_tags: [],
  username: 'royzheng',
  full_name: null,
  avatar_url: null,
  place_name: 'Noodle Bar',
  place_address: null,
  place_lat: null,
  place_lng: null,
  place_google_id: null,
  created_at: null,
  last_edited_at: null,
  edit_count: null,
}

describe('useSavedPosts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReadOfflineCache.mockResolvedValue(null)
    mockFetchSavedPostsPage.mockResolvedValue({
      rows: [savedPostRow],
      nextCursor: null,
    })
    mockMapRowToPost.mockReturnValue(savedPost)
  })

  it('uses a versioned first-page cache key for saved post covers', async () => {
    renderHook(() => useSavedPosts('user-1'))

    await waitFor(() => {
      expect(mockReadOfflineCache).toHaveBeenCalledWith(
        'saved-posts:user-1:first-page:v3',
        expect.any(Function)
      )
    })
    await waitFor(() => {
      expect(mockWriteOfflineCache).toHaveBeenCalledWith(
        'saved-posts:user-1:first-page:v3',
        [savedPost]
      )
    })
  })
})
