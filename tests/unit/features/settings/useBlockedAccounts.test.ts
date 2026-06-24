import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useBlockedAccounts } from '@/features/settings/hooks/useBlockedAccounts'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { fetchBlockedAccounts, unblockUser, type BlockedAccount } from '@/lib/services/moderation'

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: jest.fn(),
}))

jest.mock('@/lib/services/moderation', () => ({
  fetchBlockedAccounts: jest.fn(),
  unblockUser: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    blockedAccountsSearchUsed: jest.fn(),
  },
}))

const mockUseAuth = jest.mocked(useAuth)
const mockUseConnectivity = jest.mocked(useConnectivity)
const mockFetchBlockedAccounts = jest.mocked(fetchBlockedAccounts)
const mockUnblockUser = jest.mocked(unblockUser)
const mockAnalytics = jest.mocked(analytics)

const firstAccount: BlockedAccount = {
  blockedUserId: 'blocked-1',
  username: 'sarah',
  fullName: 'Sarah Lee',
  avatarUrl: null,
  blockedAt: '2026-06-24T00:00:00.000Z',
}
const secondAccount: BlockedAccount = {
  blockedUserId: 'blocked-2',
  username: 'lee',
  fullName: null,
  avatarUrl: null,
  blockedAt: '2026-06-23T00:00:00.000Z',
}
const accounts: BlockedAccount[] = [firstAccount, secondAccount]

describe('useBlockedAccounts', () => {
  const requireOnline = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-24T00:00:00.000Z'))
    jest.clearAllMocks()
    requireOnline.mockReturnValue(true)
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as never)
    mockUseConnectivity.mockReturnValue({ requireOnline } as never)
    mockFetchBlockedAccounts.mockResolvedValue(accounts)
    mockUnblockUser.mockResolvedValue(null)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('loads blocked accounts and derives the count from the loaded list', async () => {
    const { result } = renderHook(() => useBlockedAccounts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.count).toBe(2)
    expect(result.current.blockedAccounts).toEqual(accounts)
    expect(mockFetchBlockedAccounts).toHaveBeenCalledWith('user-1')
  })

  it('trims search, treats whitespace as empty, and tracks search once per session', async () => {
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setSearchQuery('   '))
    expect(result.current.filteredAccounts).toHaveLength(2)
    expect(mockAnalytics.blockedAccountsSearchUsed).not.toHaveBeenCalled()

    act(() => result.current.setSearchQuery(' sar '))
    expect(result.current.filteredAccounts).toEqual([firstAccount])
    expect(mockAnalytics.blockedAccountsSearchUsed).toHaveBeenCalledTimes(1)

    act(() => result.current.setSearchQuery(' lee '))
    expect(mockAnalytics.blockedAccountsSearchUsed).toHaveBeenCalledTimes(1)
  })

  it('refreshes stale data on demand', async () => {
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      jest.setSystemTime(new Date('2026-06-24T00:02:00.000Z'))
      result.current.refreshIfStale()
    })

    await waitFor(() => expect(mockFetchBlockedAccounts).toHaveBeenCalledTimes(2))
  })

  it('optimistically removes unblocked accounts and keeps stale remote deletes successful', async () => {
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.unblock(firstAccount)
    })

    expect(mockUnblockUser).toHaveBeenCalledWith('user-1', 'blocked-1')
    expect(result.current.blockedAccounts).toEqual([secondAccount])
    expect(result.current.count).toBe(1)
  })

  it('rolls back optimistic unblock failures', async () => {
    mockUnblockUser.mockResolvedValueOnce('Nope')
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.unblock(firstAccount)
    })

    expect(result.current.blockedAccounts).toEqual(accounts)
    expect(result.current.count).toBe(2)
    expect(result.current.error).toBe('Nope')
  })

  it('does not queue or run unblock while offline', async () => {
    requireOnline.mockReturnValue(false)
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.unblock(firstAccount)
    })

    expect(mockUnblockUser).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Reconnect to unblock this account.')
  })

  it('prevents concurrent unblocks for the same blocked account', async () => {
    let resolveUnblock: (value: string | null) => void = () => {}
    mockUnblockUser.mockImplementationOnce(() => new Promise(resolve => {
      resolveUnblock = resolve
    }))
    const { result } = renderHook(() => useBlockedAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    void act(() => {
      void result.current.unblock(firstAccount)
      void result.current.unblock(firstAccount)
    })

    expect(mockUnblockUser).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveUnblock(null)
    })
  })
})
