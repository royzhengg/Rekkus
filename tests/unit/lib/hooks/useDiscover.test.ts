import { renderHook } from '@testing-library/react-native'
import { useAuth } from '@/lib/contexts/AuthContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useDiscover } from '@/lib/hooks/useDiscover'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useTopicFollows } from '@/lib/hooks/useTopicFollows'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { useUserLocation } from '@/lib/hooks/useUserLocation'
import type { Post } from '@/types/domain'

jest.mock('@/lib/hooks/useSearchHistory', () => ({ useSearchHistory: jest.fn() }))
jest.mock('@/lib/hooks/useTopicFollows', () => ({ useTopicFollows: jest.fn() }))
jest.mock('@/lib/hooks/useTrendingData', () => ({ useTrendingData: jest.fn() }))
jest.mock('@/lib/hooks/useUserLocation', () => ({ useUserLocation: jest.fn() }))
jest.mock('@/lib/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/lib/contexts/PostsContext', () => ({ usePosts: jest.fn() }))

const mockUseSearchHistory = jest.mocked(useSearchHistory)
const mockUseTopicFollows = jest.mocked(useTopicFollows)
const mockUseTrendingData = jest.mocked(useTrendingData)
const mockUseUserLocation = jest.mocked(useUserLocation)
const mockUseAuth = jest.mocked(useAuth)
const mockUsePosts = jest.mocked(usePosts)

function post(overrides: Partial<Post>): Post {
  return {
    id: 1,
    dbId: 'post-1',
    title: 'Ramen',
    body: 'Good',
    creator: 'Roy',
    initials: 'RO',
    avatarBg: '#fff',
    avatarColor: '#000',
    likes: '0',
    imgKey: 'warm',
    tall: false,
    tags: [],
    location: 'Sydney',
    food: 4,
    vibe: 4,
    cost: 3,
    cuisine_type: 'Japanese',
    ...overrides,
  }
}

describe('useDiscover dismissed cuisine signals', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>)
    mockUseTopicFollows.mockReturnValue([])
    mockUseTrendingData.mockReturnValue({
      trendingSearches: [],
      trendingPlaceIds: [],
      trendingPostIds: [],
      popularPlaces: [],
      trendingDishes: [],
    })
    mockUseUserLocation.mockReturnValue({
      coords: null,
      label: null,
      status: 'idle',
      error: null,
      loading: false,
      requestLocation: jest.fn(),
      setManualLocation: jest.fn(),
      clearLocation: jest.fn(),
    })
  })

  it('downranks posts whose cuisine matches dismissed search cuisines', () => {
    const japanese = post({ id: 1, dbId: 'jp', cuisine_type: 'Japanese', food: 5, title: 'Ramen', likes: '100' })
    const italian = post({ id: 2, dbId: 'it', cuisine_type: 'Italian', food: 3, title: 'Pasta', likes: '60' })
    mockUsePosts.mockReturnValue({ posts: [japanese, italian], setPosts: jest.fn() } as never)
    mockUseSearchHistory.mockReturnValue({
      cuisineAffinities: {},
      dismissedCuisines: { japanese: 1 },
      recentSearches: [],
      savedSearches: [],
      dismissSearch: jest.fn(),
      saveSearch: jest.fn(),
      unsaveSearch: jest.fn(),
    })

    const { result } = renderHook(() => useDiscover())

    expect(result.current.map(item => item.id)).toEqual([2, 1])
  })
})
