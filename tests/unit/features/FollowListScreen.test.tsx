import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import React from 'react'
import FollowListScreen from '@/features/profile/FollowListScreen'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import {
  fetchFollowers,
  fetchFollowing,
  fetchUserIdByUsername,
  subscribeToFollowChanges,
} from '@/lib/services/users'

const mockPush = jest.fn()
const mockBack = jest.fn()
let mockParams: { username?: string; listType?: string } = { username: 'roy', listType: 'followers' }

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react')
  return {
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactActual.useEffect(() => callback(), [callback])
    },
  }
})

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  return { ChevronLeft: () => <Text>back-icon</Text> }
})

jest.mock('@/components/Avatar', () => {
  const { Text } = jest.requireActual('react-native')
  return { Avatar: ({ initials }: { initials: string }) => <Text>{initials}</Text> }
})

jest.mock('@/components/ui/CachedImage', () => ({
  CachedImage: () => null,
}))

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'viewer-1' } }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { profileFollowListOpened: jest.fn() },
}))

jest.mock('@/lib/services/users', () => ({
  fetchFollowers: jest.fn(),
  fetchFollowing: jest.fn(),
  fetchUserIdByUsername: jest.fn(),
  removeFollowChannel: jest.fn(),
  subscribeToFollowChanges: jest.fn(),
}))

const mockUseConnectivity = jest.mocked(useConnectivity)
const mockFetchUserIdByUsername = jest.mocked(fetchUserIdByUsername)
const mockFetchFollowers = jest.mocked(fetchFollowers)
const mockFetchFollowing = jest.mocked(fetchFollowing)
const mockSubscribeToFollowChanges = jest.mocked(subscribeToFollowChanges)

describe('FollowListScreen', () => {
  let realtimeHandler: Parameters<typeof subscribeToFollowChanges>[1] | null = null
  let syncEpoch = 0

  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = { username: 'roy', listType: 'followers' }
    realtimeHandler = null
    syncEpoch = 0
    mockUseConnectivity.mockImplementation(() => ({
      state: 'online',
      pendingCount: 0,
      isSyncing: false,
      syncState: 'idle',
      syncEpoch,
      runDeferredMutation: jest.fn(),
      requireOnline: jest.fn(() => true),
    }))
    mockFetchUserIdByUsername.mockResolvedValue('target-1')
    mockFetchFollowers.mockResolvedValue([
      { id: 'u1', username: 'sarah', full_name: 'Sarah Lee', avatar_url: null },
    ])
    mockFetchFollowing.mockResolvedValue([
      { id: 'u2', username: 'lee', full_name: null, avatar_url: null },
    ])
    mockSubscribeToFollowChanges.mockImplementation((_userId, onChange) => {
      realtimeHandler = onChange
      return { id: 'channel-1' } as never
    })
  })

  it('loads followers from route params and opens user profiles', async () => {
    render(<FollowListScreen />)

    expect(await screen.findByText('Sarah Lee')).toBeTruthy()
    expect(mockFetchFollowers).toHaveBeenCalledWith('target-1')

    fireEvent.press(screen.getByLabelText('Open Sarah Lee profile'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/user/[username]',
      params: { username: 'sarah' },
    })
  })

  it('switches to following and reloads that list', async () => {
    render(<FollowListScreen />)
    await screen.findByText('Sarah Lee')

    fireEvent.press(screen.getByText('Following'))

    expect(await screen.findByText('@lee')).toBeTruthy()
    expect(mockFetchFollowing).toHaveBeenCalledWith('target-1')
  })

  it('renders empty and error states', async () => {
    mockFetchFollowers.mockResolvedValueOnce([])
    const empty = render(<FollowListScreen />)
    expect(await screen.findByText('No followers yet')).toBeTruthy()

    empty.unmount()
    mockFetchFollowers.mockRejectedValueOnce(new Error('failed'))
    render(<FollowListScreen />)
    expect(await screen.findByText('Could not load list')).toBeTruthy()
  })

  it('refreshes after realtime follow changes and sync epoch changes', async () => {
    const { rerender } = render(<FollowListScreen />)
    await screen.findByText('Sarah Lee')
    expect(mockFetchFollowers).toHaveBeenCalledTimes(1)

    act(() => {
      realtimeHandler?.({ eventType: 'INSERT', followerId: 'new-user', followingId: 'target-1' })
    })
    await waitFor(() => expect(mockFetchFollowers).toHaveBeenCalledTimes(2))

    syncEpoch = 1
    rerender(<FollowListScreen />)
    await waitFor(() => expect(mockFetchFollowers).toHaveBeenCalledTimes(3))
  })
})
