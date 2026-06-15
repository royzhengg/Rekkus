import { renderHook } from '@testing-library/react-native'
import { useSavedLibrary } from '@/features/saved/useSavedLibrary'
import { useCollections } from '@/lib/hooks/useCollections'
import { useSavedDishes } from '@/lib/hooks/useSavedDishes'
import { useSavedPlaces } from '@/lib/hooks/useSavedPlaces'
import { useSavedPosts } from '@/lib/hooks/useSavedPosts'

jest.mock('@/lib/hooks/useCollections', () => ({ useCollections: jest.fn() }))
jest.mock('@/lib/hooks/useSavedDishes', () => ({ useSavedDishes: jest.fn() }))
jest.mock('@/lib/hooks/useSavedPlaces', () => ({ useSavedPlaces: jest.fn() }))
jest.mock('@/lib/hooks/useSavedPosts', () => ({ useSavedPosts: jest.fn() }))

const mockUseCollections = jest.mocked(useCollections)
const mockUseSavedDishes = jest.mocked(useSavedDishes)
const mockUseSavedPlaces = jest.mocked(useSavedPlaces)
const mockUseSavedPosts = jest.mocked(useSavedPosts)

describe('useSavedLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSavedDishes.mockReturnValue({ savedDishes: [], loading: false, error: null, refresh: jest.fn() })
    mockUseSavedPlaces.mockReturnValue({ savedPlaces: [], error: null, refresh: jest.fn(), refreshing: false })
    mockUseSavedPosts.mockReturnValue({
      savedPosts: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false,
      error: null,
    })
    mockUseCollections.mockReturnValue({ collections: [], items: [], loading: false, refresh: jest.fn() })
  })

  it('uses a stable restaurant id list for overview collection loading', () => {
    const { rerender } = renderHook(() => useSavedLibrary('user-1', 'all', ''))
    const firstRestaurantIds = mockUseCollections.mock.calls[0]?.[1]

    rerender({})

    expect(mockUseCollections.mock.calls[1]?.[1]).toBe(firstRestaurantIds)
  })
})
