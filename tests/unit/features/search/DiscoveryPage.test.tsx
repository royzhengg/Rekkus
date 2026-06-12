import { fireEvent, render } from '@testing-library/react-native'
import React from 'react'
import { DiscoveryPage } from '@/features/search/DiscoveryPage'

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    accent: '#0066cc',
    bg: '#ffffff',
    border: '#dddddd',
    surface: '#f5f5f5',
    text: '#111111',
    text2: '#555555',
    text3: '#777777',
  }),
}))

jest.mock('@/lib/hooks/useContextualQuickStarts', () => ({
  useContextualQuickStarts: () => [],
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    collectionInteraction: jest.fn(),
    viewDish: jest.fn(),
  },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock('@/lib/contexts/AuthGateContext', () => ({
  useAuthGate: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({
    requireOnline: jest.fn().mockReturnValue(true),
    runDeferredMutation: jest.fn(),
  }),
}))

jest.mock('@/lib/services/users', () => ({
  fetchUserIdByUsername: jest.fn(),
}))

const baseProps = {
  isFocused: true,
  recentSearches: ['ramen', 'pho'],
  savedSearches: ['omakase CBD'],
  onDismissSearch: jest.fn(),
  onSelectRecent: jest.fn(),
  onSelectSavedSearch: jest.fn(),
  onSaveSearch: jest.fn(),
  onUnsaveSearch: jest.fn(),
  activeChip: '',
  trendingItems: [],
  trendingDishes: [],
  suggestedPeople: [],
  popularPlaces: [],
  staffPicks: [],
  cuisineAffinities: {},
  onChip: jest.fn(),
  onTrending: jest.fn(),
  onTrendingDish: jest.fn(),
  onOpenNearby: jest.fn(),
  userId: 'user-1',
}

describe('DiscoveryPage saved searches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders saved searches above recent searches', () => {
    const screen = render(<DiscoveryPage {...baseProps} />)
    const rendered = JSON.stringify(screen.toJSON())

    expect(screen.getByText('Saved searches')).toBeTruthy()
    expect(screen.getByText('Recent searches')).toBeTruthy()
    expect(rendered.indexOf('Saved searches')).toBeLessThan(rendered.indexOf('Recent searches'))
  })

  it('reruns saved and recent searches from their row taps', () => {
    const screen = render(<DiscoveryPage {...baseProps} />)

    fireEvent.press(screen.getByLabelText('Search saved query omakase CBD'))
    fireEvent.press(screen.getByLabelText('Search for ramen'))

    expect(baseProps.onSelectSavedSearch).toHaveBeenCalledWith('omakase CBD')
    expect(baseProps.onSelectRecent).toHaveBeenCalledWith('ramen')
  })

  it('separates save, unsave, and dismiss actions', () => {
    const screen = render(<DiscoveryPage {...baseProps} />)

    fireEvent.press(screen.getByLabelText('Save search ramen'))
    fireEvent.press(screen.getByLabelText('Unsave search omakase CBD'))
    fireEvent.press(screen.getByLabelText('Remove recent search ramen'))

    expect(baseProps.onSaveSearch).toHaveBeenCalledWith('ramen')
    expect(baseProps.onUnsaveSearch).toHaveBeenCalledWith('omakase CBD')
    expect(baseProps.onDismissSearch).toHaveBeenCalledWith('ramen')
  })

  it('hides saved-search controls for signed-out users', () => {
    const screen = render(<DiscoveryPage {...baseProps} userId={undefined} />)

    expect(screen.queryByText('Saved searches')).toBeNull()
    expect(screen.queryByLabelText('Save search ramen')).toBeNull()
  })
})
