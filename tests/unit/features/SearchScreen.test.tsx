import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import SearchScreen from '@/features/search/SearchScreen'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useNoResultsSuggestions } from '@/lib/hooks/useNoResultsSuggestions'
import { useSearch } from '@/lib/hooks/useSearch'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSearchLocation } from '@/lib/hooks/useSearchLocation'
import { useTrendingData } from '@/lib/hooks/useTrendingData'
import { useUserLocation } from '@/lib/hooks/useUserLocation'

jest.mock('expo-sqlite/localStorage/install', () => {})
jest.mock('expo-sqlite', () => ({}))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ query: 'pork' }),
  useFocusEffect: jest.fn(),
}))

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    SearchIcon: () => <Text>search</Text>,
    CloseIcon: () => <Text>close</Text>,
    FilterIcon: () => <Text>filter</Text>,
    PinIcon: () => <Text>pin</Text>,
  }
})

jest.mock('@/features/search/SearchFiltersSheet', () => ({ SearchFiltersSheet: () => null }))
jest.mock('@/features/search/SearchResultsTab', () => ({ SearchResultsTab: () => null }))
jest.mock('@/features/search/DiscoveryPage', () => ({ DiscoveryPage: () => null }))

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/hooks/useUserLocation', () => ({
  useUserLocation: jest.fn(),
}))

jest.mock('@/lib/hooks/useSearchLocation', () => ({
  useSearchLocation: jest.fn(),
}))

jest.mock('@/lib/hooks/useSearch', () => ({
  useSearch: jest.fn(),
}))

jest.mock('@/lib/hooks/useNoResultsSuggestions', () => ({
  useNoResultsSuggestions: jest.fn(),
}))

jest.mock('@/lib/hooks/useSearchHistory', () => ({
  loadPersistedSearchState: jest.fn(() => new Promise(() => undefined)),
  persistSearchState: jest.fn(),
  useSearchHistory: jest.fn(),
}))

jest.mock('@/lib/hooks/useTrendingData', () => ({
  useTrendingData: jest.fn(),
}))

jest.mock('@/lib/services/collections', () => ({
  fetchStaffPickCollections: jest.fn(() => new Promise(() => undefined)),
}))

jest.mock('@/lib/services/searchPersonalization', () => ({
  fetchUserEngagementCuisines: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/services/trending', () => ({
  resolveTrendingCityFromCoords: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/utils/queryParser', () => ({
  parseSearchQuery: jest.fn(() => ({ intent: 'dish' })),
}))

jest.mock('@/lib/featureFlags', () => ({
  isEnabled: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    searchLocationNudgeShown: jest.fn(),
    searchLocationNudgeClicked: jest.fn(),
    searchLocationPermissionResult: jest.fn(),
    noResultsShown: jest.fn(),
    searchQuery: jest.fn(),
    searchSessionEnd: jest.fn(),
    searchAbandon: jest.fn(),
    searchFilter: jest.fn(),
    noResultsSuggestionClick: jest.fn(),
  },
}))

const mockUseAuth = jest.mocked(useAuth)
const mockUseUserLocation = jest.mocked(useUserLocation)
const mockUseSearchLocation = jest.mocked(useSearchLocation)
const mockUseSearch = jest.mocked(useSearch)
const mockUseNoResultsSuggestions = jest.mocked(useNoResultsSuggestions)
const mockUseSearchHistory = jest.mocked(useSearchHistory)
const mockUseTrendingData = jest.mocked(useTrendingData)
const mockOpenSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()

const requestLocation = jest.fn()

function baseLocation(overrides: Partial<ReturnType<typeof useUserLocation>> = {}): ReturnType<typeof useUserLocation> {
  return {
    coords: null,
    label: null,
    status: 'idle',
    error: null,
    loading: false,
    requestLocation,
    setManualLocation: jest.fn(),
    clearLocation: jest.fn(),
    ...overrides,
  }
}

function baseSearch(overrides: Partial<ReturnType<typeof useSearch>> = {}): ReturnType<typeof useSearch> {
  return {
    postResults: [],
    peopleResults: [],
    placeResults: [],
    placeDistances: new Map<string, number>(),
    dishEntityResults: [],
    candidates: [],
    suggestions: [],
    providerFallbackSuppressed: true,
    providerFallbackReason: 'ambiguous_food_without_location',
    queryIntent: 'food_dish',
    hasQuery: true,
    expansionLabel: null,
    topFeed: [],
    ...overrides,
  } as ReturnType<typeof useSearch>
}

describe('SearchScreen location nudge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requestLocation.mockResolvedValue({ lat: -33.87, lng: 151.21 })
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    mockUseUserLocation.mockReturnValue(baseLocation())
    mockUseSearchLocation.mockReturnValue(baseLocation())
    mockUseSearch.mockReturnValue(baseSearch())
    mockUseNoResultsSuggestions.mockReturnValue([
      { label: 'Ramen', query: 'ramen' },
      { label: 'Sushi', query: 'sushi' },
      { label: 'Dumplings', query: 'dumplings' },
    ])
    mockUseSearchHistory.mockReturnValue({
      cuisineAffinities: {},
      dismissedCuisines: {},
      recentSearches: [],
      savedSearches: [],
      dismissSearch: jest.fn(),
      saveSearch: jest.fn(),
      unsaveSearch: jest.fn(),
    })
    mockUseTrendingData.mockReturnValue({
      trendingSearches: [],
      trendingPlaceIds: [],
      trendingPostIds: [],
      popularPlaces: [],
      trendingDishes: [],
    })
  })

  afterAll(() => {
    mockOpenSettings.mockRestore()
  })

  it('shows the nudge for food queries without location after provider fallback is suppressed', () => {
    render(<SearchScreen />)

    expect(screen.getByText('Enable location for better results')).toBeTruthy()
    expect(analytics.searchLocationNudgeShown).toHaveBeenCalledWith(
      null,
      'food_dish',
      'none',
      'search'
    )
  })

  it('requests location and records analytics when the nudge is tapped', async () => {
    render(<SearchScreen />)

    fireEvent.press(screen.getByLabelText('Enable location for better search results'))

    await waitFor(() => {
      expect(requestLocation).toHaveBeenCalledTimes(1)
    })
    expect(analytics.searchLocationNudgeClicked).toHaveBeenCalledWith(
      null,
      'food_dish',
      'none',
      'search'
    )
    expect(analytics.searchLocationPermissionResult).toHaveBeenCalledWith(
      null,
      'granted',
      'food_dish',
      'search'
    )
  })

  it('opens Settings for denied location status', async () => {
    mockUseUserLocation.mockReturnValue(baseLocation({ status: 'denied' }))
    mockUseSearchLocation.mockReturnValue(baseLocation({ status: 'denied' }))
    render(<SearchScreen />)

    expect(screen.getByText('Open Settings for better local results')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Open Settings to enable location for better search results'))

    await waitFor(() => {
      expect(mockOpenSettings).toHaveBeenCalledTimes(1)
    })
    expect(analytics.searchLocationPermissionResult).toHaveBeenCalledWith(
      null,
      'settings_opened',
      'food_dish',
      'search'
    )
  })

  it('hides the nudge when dismissed', () => {
    render(<SearchScreen />)

    fireEvent.press(screen.getByLabelText('Dismiss location suggestion'))

    expect(screen.queryByText('Enable location for better results')).toBeNull()
  })
})
