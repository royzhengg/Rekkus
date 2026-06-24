import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import React from 'react'
import BlockedAccountsScreen from '@/features/settings/BlockedAccountsScreen'
import { useBlockedAccounts } from '@/features/settings/hooks/useBlockedAccounts'
import type { BlockedAccount } from '@/lib/services/moderation'

const mockBack = jest.fn()
const mockShowToast = jest.fn()
const mockUnblock = jest.fn()
const mockRefresh = jest.fn()
const mockRefreshIfStale = jest.fn()
const mockSetSearchQuery = jest.fn()

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react')
  return {
    useRouter: () => ({ back: mockBack }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactActual.useEffect(() => callback(), [callback])
    },
  }
})

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
  SearchIcon: () => null,
}))

jest.mock('@/components/ui/CachedImage', () => ({
  CachedImage: () => null,
}))

jest.mock('@/components/ui/RekkusActionSheet', () => {
  const { Text, TouchableOpacity, View } = jest.requireActual('react-native')
  return {
    RekkusActionSheet: ({
      title,
      subtitle,
      options,
      onSelect,
    }: {
      title?: string
      subtitle?: string
      options: { label: string; value: string }[]
      onSelect: (value: string) => void
    }) => (
      <View>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {options.map(option => (
          <TouchableOpacity key={option.value} onPress={() => onSelect(option.value)} accessibilityRole="button">
            <Text>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  }
})

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { blockedAccountsScreenViewed: jest.fn() },
}))

jest.mock('@/features/settings/hooks/useBlockedAccounts', () => ({
  useBlockedAccounts: jest.fn(),
}))

const mockUseBlockedAccounts = jest.mocked(useBlockedAccounts)

const account: BlockedAccount = {
  blockedUserId: 'blocked-1',
  username: 'sarah',
  fullName: 'Sarah Lee',
  avatarUrl: null,
  blockedAt: '2026-06-14T00:00:00.000Z',
}

function mockHook(overrides: Partial<ReturnType<typeof useBlockedAccounts>> = {}) {
  mockUseBlockedAccounts.mockReturnValue({
    blockedAccounts: [account],
    count: 1,
    error: null,
    filteredAccounts: [account],
    loading: false,
    refresh: mockRefresh,
    refreshing: false,
    refreshIfStale: mockRefreshIfStale,
    searchQuery: '',
    setSearchQuery: mockSetSearchQuery,
    trimmedSearchQuery: '',
    unblock: mockUnblock,
    unblockingIds: new Set(),
    ...overrides,
  })
}

describe('BlockedAccountsScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-24T00:00:00.000Z'))
    jest.clearAllMocks()
    mockUnblock.mockResolvedValue(true)
    mockHook()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders blocked accounts and search controls', () => {
    render(<BlockedAccountsScreen />)

    expect(screen.getByText('Blocked accounts')).toBeTruthy()
    expect(screen.getByLabelText('Search blocked accounts')).toBeTruthy()
    expect(screen.getByText('Sarah Lee')).toBeTruthy()
    expect(screen.getByText('@sarah')).toBeTruthy()
    expect(screen.getByText(/Blocking prevents accounts/)).toBeTruthy()
    expect(mockRefreshIfStale).toHaveBeenCalled()
  })

  it('renders deleted-account and empty-search states', () => {
    mockHook({
      filteredAccounts: [{
        blockedUserId: 'deleted-1',
        username: null,
        fullName: null,
        avatarUrl: null,
        blockedAt: '2026-06-13T00:00:00.000Z',
      }],
    })
    const first = render(<BlockedAccountsScreen />)
    expect(screen.getByText('Deleted account')).toBeTruthy()
    first.unmount()

    mockHook({ filteredAccounts: [], searchQuery: 'missing', trimmedSearchQuery: 'missing' })
    render(<BlockedAccountsScreen />)
    expect(screen.getByText('No blocked accounts found')).toBeTruthy()
    expect(screen.getByText('Try a different name or username.')).toBeTruthy()
  })

  it('renders loading and error states', () => {
    mockHook({ loading: true, filteredAccounts: [] })
    const loading = render(<BlockedAccountsScreen />)
    expect(screen.queryByText('Sarah Lee')).toBeNull()
    loading.unmount()

    mockHook({ error: 'Blocked accounts could not be loaded right now.' })
    render(<BlockedAccountsScreen />)
    expect(screen.getByText('Could not update blocked accounts')).toBeTruthy()
  })

  it('confirms unblock and shows success feedback', async () => {
    render(<BlockedAccountsScreen />)

    fireEvent.press(screen.getByLabelText('Unblock Sarah Lee'))

    expect(screen.getByText('Unblock @sarah?')).toBeTruthy()
    expect(screen.getByText("They'll be able to find you, message you, and interact with you again. Follow relationships won't be restored automatically.")).toBeTruthy()

    fireEvent.press(screen.getAllByText('Unblock')[1])

    await waitFor(() => {
      expect(mockUnblock).toHaveBeenCalledWith(account)
      expect(mockShowToast).toHaveBeenCalledWith('Account unblocked')
    })
  })

  it('passes search changes to the hook', () => {
    render(<BlockedAccountsScreen />)

    fireEvent.changeText(screen.getByLabelText('Search blocked accounts'), ' sar ')

    expect(mockSetSearchQuery).toHaveBeenCalledWith(' sar ')
  })
})
