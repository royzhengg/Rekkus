import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { filterSavedLibraryItems, type SavedLibraryItem, type SavedLibraryScope } from '@/features/saved/savedLibrary'
import SavedScreen from '@/features/saved/SavedScreen'
import { useSavedLibrary } from '@/features/saved/useSavedLibrary'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import {
  addTargetToCollection,
  removeTargetFromCollection,
  unsaveTarget,
} from '@/lib/services/collections'

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockSection: string | undefined

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ section: mockSection }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    BookmarkIcon: () => <Text>bookmark-icon</Text>,
    ChevronRight: () => <Text>chevron-icon</Text>,
    ImagePlaceholder: () => <Text>image-placeholder</Text>,
    ListIcon: () => <Text>list-icon</Text>,
    PinIcon: () => <Text>pin-icon</Text>,
    PlusIcon: () => <Text>plus-icon</Text>,
    SearchIcon: () => <Text>search-icon</Text>,
  }
})

jest.mock('@/components/ui/CachedImage', () => ({
  CachedImage: () => null,
}))

jest.mock('@/components/ThumbGrid', () => ({
  ThumbGrid: () => null,
}))


jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    collectionInteraction: jest.fn(),
    savedLibraryInteraction: jest.fn(),
  },
}))

jest.mock('@/features/saved/useSavedLibrary', () => ({
  useSavedLibrary: jest.fn(),
}))

jest.mock('@/lib/services/collections', () => ({
  addTargetToCollection: jest.fn(),
  createPrivateCollection: jest.fn(),
  removeTargetFromCollection: jest.fn(),
  unsaveTarget: jest.fn(),
  updateCollectionVisibility: jest.fn(),
}))

jest.mock('@/components/ui/RekkusActionSheet', () => ({
  RekkusActionSheet: ({
    visible,
    options,
    onSelect,
  }: {
    visible: boolean
    options: Array<{ label: string; value: string }>
    onSelect: (value: string) => void
  }) => {
    const { Text, TouchableOpacity } = jest.requireActual('react-native')
    return visible ? (
      <>
        {options.map(option => (
          <TouchableOpacity key={option.value} onPress={() => onSelect(option.value)} accessibilityRole="button">
            <Text>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </>
    ) : null
  },
}))

const items: SavedLibraryItem[] = [
  {
    id: 'dish:dish-1',
    type: 'dish',
    title: 'Chilli wontons',
    subtitle: 'Golden Dumpling',
    savedAt: '2026-06-12T10:00:00.000Z',
    targetType: 'dish',
    targetId: 'dish-1',
    routeId: 'dish-1',
  },
  {
    id: 'restaurant:restaurant-1',
    type: 'restaurant',
    title: 'Golden Dumpling',
    subtitle: '1 Market Street',
    savedAt: '2026-06-11T10:00:00.000Z',
    targetType: 'restaurant',
    targetId: 'restaurant-1',
    routeId: 'restaurant-1',
  },
  {
    id: 'collection:collection-1',
    type: 'collection',
    title: 'Weeknight favourites',
    subtitle: 'Private',
    savedAt: '1970-01-01T00:00:00.000Z',
    status: 'Private',
    routeId: 'collection-1',
  },
]

const refresh = jest.fn()
const mockUseSavedLibrary = jest.mocked(useSavedLibrary)
const mockUseConnectivity = jest.mocked(useConnectivity)
const mockAddTargetToCollection = jest.mocked(addTargetToCollection)
const mockRemoveTargetFromCollection = jest.mocked(removeTargetFromCollection)
const mockUnsaveTarget = jest.mocked(unsaveTarget)

function lastCollectionOption() {
  const matches = screen.getAllByText('Weeknight favourites')
  const option = matches.at(-1)
  if (!option) throw new Error('Expected collection option')
  return option
}

function setupLibraryMock() {
  mockUseSavedLibrary.mockImplementation((_userId: string | undefined, scope: SavedLibraryScope, query: string) => ({
    collections: [
      {
        id: 'collection-1',
        user_id: 'user-1',
        name: 'Weeknight favourites',
        description: null,
        visibility: 'private',
        share_slug: null,
      },
    ],
    counts: { dishes: 1, places: 1, posts: 0, collections: 1 },
    error: null,
    items,
    loading: false,
    results: filterSavedLibraryItems(items, scope, query),
    refresh,
    raw: {
      collections: { collections: [], items: [], loading: false, refresh },
      dishes: { savedDishes: [], loading: false, error: null, refresh },
      locations: { savedLocations: [], error: null, refresh, refreshing: false },
      posts: { savedPosts: [], loading: false, loadingMore: false, hasMore: false, loadMore: jest.fn(), refresh, refreshing: false, error: null },
    },
  }))
}

describe('SavedScreen overview library', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSection = undefined
    refresh.mockResolvedValue(undefined)
    mockAddTargetToCollection.mockResolvedValue(undefined)
    mockRemoveTargetFromCollection.mockResolvedValue(undefined)
    mockUnsaveTarget.mockResolvedValue(undefined)
    mockUseConnectivity.mockReturnValue({
      requireOnline: jest.fn(() => true),
    } as never)
    setupLibraryMock()
  })

  it('searches mixed saved items and opens results', () => {
    render(<SavedScreen />)

    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.getAllByText('Saved')).toHaveLength(1)
    expect(screen.getByText('3 items')).toBeTruthy()
    expect(screen.getByText('All 3')).toBeTruthy()
    expect(screen.queryByText('Recent saves')).toBeNull()
    expect(screen.queryByText('Find what you wanted to try again.')).toBeNull()

    fireEvent.changeText(screen.getByLabelText('Search saved library'), 'weeknight')

    expect(screen.getByText('Weeknight favourites')).toBeTruthy()
    expect(screen.queryByText('Chilli wontons')).toBeNull()

    fireEvent.press(screen.getByText('Weeknight favourites'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/collections/[collectionId]',
      params: { collectionId: 'collection-1' },
    })
  })

  it('opens the saved places map and filters to lists from the action strip', () => {
    render(<SavedScreen />)

    fireEvent.press(screen.getByLabelText('View saved places on map'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/saved/places',
      params: { view: 'map' },
    })

    fireEvent.press(screen.getByLabelText('View saved lists, 1 saved'))
    expect(screen.getByText('1 list')).toBeTruthy()
    expect(screen.getByText('Weeknight favourites')).toBeTruthy()
    expect(screen.queryByText('Chilli wontons')).toBeNull()
  })

  it('selects saved targets and adds them to a collection', async () => {
    render(<SavedScreen />)

    fireEvent(screen.getByLabelText('Open saved dish Chilli wontons'), 'longPress')
    expect(screen.getByText('1 selected')).toBeTruthy()

    fireEvent.press(screen.getByText('Add to list'))
    fireEvent.press(lastCollectionOption())

    await waitFor(() => {
      expect(mockAddTargetToCollection).toHaveBeenCalledWith('collection-1', 'dish', 'dish-1')
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('removes selected targets from collections and confirms bulk unsave failures', async () => {
    mockUnsaveTarget.mockRejectedValueOnce(new Error('network'))
    render(<SavedScreen />)

    fireEvent(screen.getByLabelText('Open saved dish Chilli wontons'), 'longPress')
    fireEvent.press(screen.getByText('Remove'))
    fireEvent.press(lastCollectionOption())

    await waitFor(() => {
      expect(mockRemoveTargetFromCollection).toHaveBeenCalledWith('collection-1', 'dish', 'dish-1')
    })

    fireEvent(screen.getByLabelText('Open saved dish Chilli wontons'), 'longPress')
    fireEvent.press(screen.getByText('Unsave'))
    fireEvent.press(screen.getByText('Remove from Saved'))

    await waitFor(() => {
      expect(mockUnsaveTarget).toHaveBeenCalledWith('dish', 'dish-1', true)
    })
    expect(await screen.findByText('Some items could not be removed from Saved.')).toBeTruthy()
  })
})

describe('SavedScreen feature boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSection = undefined
    refresh.mockResolvedValue(undefined)
    mockUseConnectivity.mockReturnValue({ requireOnline: jest.fn(() => true) } as never)
    setupLibraryMock()
  })

  it('Places filter scopes the overview without inline-rendering RestaurantsTabScreen', () => {
    render(<SavedScreen />)
    fireEvent.press(screen.getByLabelText('Places, 1 saved'))
    expect(screen.getByText('Place')).toBeTruthy()
    expect(screen.getByText('1 Market Street')).toBeTruthy()
    expect(screen.queryByText('Want to try')).toBeNull()
    expect(screen.queryByText('Been here')).toBeNull()
    expect(screen.queryByText('Chilli wontons')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not render RestaurantsTabScreen inline when section is places', () => {
    mockSection = 'places'
    render(<SavedScreen />)
    // Should show the library overview, not a restaurants map view
    expect(screen.queryByText('Saved places map')).toBeNull()
  })
})
