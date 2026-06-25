import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import FeedScreen from '@/features/feed/FeedScreen'
import { useFollowingFeed } from '@/lib/hooks/useFollowingFeed'
import type React from 'react'

const mockPush = jest.fn()
const mockOpenCreateLauncher = jest.fn()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useScrollToTop: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    BellIcon: () => <Text>bell</Text>,
    SaveIcon: () => <Text>save</Text>,
    HeartIcon: () => <Text>heart</Text>,
    MessageIcon: () => <Text>message</Text>,
    PlusIcon: () => <Text>plus</Text>,
    ShareIcon: () => <Text>share</Text>,
  }
})

jest.mock('@/components/post/PostCard', () => ({
  PostCard: () => null,
}))

jest.mock('@/components/post/PostCardSkeleton', () => {
  const { View } = jest.requireActual('react-native')
  return { PostCardSkeleton: () => <View testID="post-card-skeleton" /> }
})

jest.mock('@/components/post/PostUploadProgress', () => ({
  PostUploadProgress: () => null,
}))

jest.mock('@/components/ui/EmptyState', () => {
  const { Text } = jest.requireActual('react-native')
  return { EmptyState: ({ title }: { title: string }) => <Text>{title}</Text> }
})

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: () => null,
}))

jest.mock('@/components/ui/IconButton', () => {
  const { TouchableOpacity } = jest.requireActual('react-native')
  return {
    IconButton: ({
      accessibilityLabel,
      onPress,
      children,
    }: {
      accessibilityLabel: string
      onPress?: () => void
      children: React.ReactNode
    }) => (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
        {children}
      </TouchableOpacity>
    ),
  }
})

jest.mock('@/components/ui/RekkusActionSheet', () => ({
  RekkusActionSheet: () => null,
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    feedDiagnostic: jest.fn(),
    onboardingStep: jest.fn(),
  },
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock('@/lib/contexts/AuthGateContext', () => ({
  useAuthGate: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ runDeferredMutation: jest.fn() }),
}))

jest.mock('@/lib/contexts/CreateLauncherContext', () => ({
  useCreateLauncher: () => ({ openCreateLauncher: mockOpenCreateLauncher }),
}))

jest.mock('@/lib/contexts/PostsContext', () => ({
  usePosts: () => ({ refresh: jest.fn(), loadMore: jest.fn(), hasMore: false }),
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => jest.requireActual('@/constants/Colors').lightColors,
}))

jest.mock('@/lib/dataSources/demoData', () => ({
  demoCurrentUser: { username: 'current' },
  demoUsers: {
    chef: { followers: '12k', initials: 'CF', avatarBg: '#eee', avatarColor: '#111' },
  },
}))

jest.mock('@/lib/hooks/useDiscover', () => ({
  useDiscover: () => [],
}))

jest.mock('@/lib/hooks/useFollowingFeed', () => ({
  useFollowingFeed: jest.fn(),
}))

jest.mock('@/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}))

const mockUseFollowingFeed = jest.mocked(useFollowingFeed)
const mockAsyncStorage = jest.mocked(AsyncStorage)

describe('FeedScreen Taste Ledger header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAsyncStorage.getItem.mockResolvedValue(null)
    mockUseFollowingFeed.mockReturnValue({ posts: [], isLoaded: true })
  })

  it('shows the feed context line and updates it when Discover is selected', () => {
    render(<FeedScreen />)

    expect(screen.getByText('From people whose taste you trust')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Discover'))

    expect(screen.getByText('Local saves, new posts, and useful food signals')).toBeTruthy()
  })

  it('renders the first-visit ledger prompt with preserved actions', async () => {
    mockAsyncStorage.getItem.mockResolvedValue('1')
    render(<FeedScreen />)

    await waitFor(() => {
      expect(screen.getByText('Welcome to your Taste Ledger.')).toBeTruthy()
    })

    fireEvent.press(screen.getByLabelText('Explore nearby dishes'))
    expect(screen.getByText('Local saves, new posts, and useful food signals')).toBeTruthy()
  })
})
