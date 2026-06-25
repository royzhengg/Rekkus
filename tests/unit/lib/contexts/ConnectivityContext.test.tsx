import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as Network from 'expo-network'
import React from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { ConnectivityProvider, useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { getSession } from '@/lib/services/auth'
import {
  executeDeferredMutation,
  readDeferredMutations,
  removeDeferredMutation,
} from '@/lib/services/deferredMutations'

// Capture the network listener so tests can simulate connectivity changes
let capturedNetworkListener: ((state: Network.NetworkState) => void) | null = null

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn((cb: (state: Network.NetworkState) => void) => {
    capturedNetworkListener = cb
    return { remove: jest.fn() }
  }),
  NetworkStateType: {
    WIFI: 'wifi',
    CELLULAR: 'cellular',
    BLUETOOTH: 'bluetooth',
    ETHERNET: 'ethernet',
    WIMAX: 'wimax',
    VPN: 'vpn',
    OTHER: 'other',
    NONE: 'none',
    UNKNOWN: 'unknown',
  },
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/services/auth', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/services/deferredMutations', () => ({
  clearDeferredMutationsForUser: jest.fn(),
  deferredMutationDomain: jest.fn(() => 'post_like'),
  enqueueDeferredMutation: jest.fn(),
  executeDeferredMutation: jest.fn(),
  incrementRetryCount: jest.fn((m: { retryCount: number }) => ({ ...m, retryCount: m.retryCount + 1 })),
  isRetryableDeferredMutationError: jest.fn(() => false),
  MAX_RETRY_COUNT: 5,
  readDeferredMutations: jest.fn(),
  removeDeferredMutation: jest.fn(),
}))

jest.mock('@/lib/services/postDrafts', () => ({
  syncUnsyncedDraftMedia: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { actionError: jest.fn(), offlineMutation: jest.fn() },
}))

const mockUseAuth = jest.mocked(useAuth)
const mockGetSession = jest.mocked(getSession)
const mockReadDeferredMutations = jest.mocked(readDeferredMutations)
const mockExecuteDeferredMutation = jest.mocked(executeDeferredMutation)
const mockRemoveDeferredMutation = jest.mocked(removeDeferredMutation)
const mockGetNetworkStateAsync = jest.mocked(Network.getNetworkStateAsync)

const ONLINE: Network.NetworkState = { isConnected: true, isInternetReachable: true, type: Network.NetworkStateType.WIFI }
const OFFLINE: Network.NetworkState = { isConnected: false, isInternetReachable: false, type: Network.NetworkStateType.NONE }

const fakeUser = { id: 'user-1', email: 'a@b.com' } as ReturnType<typeof useAuth>['user']
const fakeAuthContext = {
  user: fakeUser,
  session: null,
  loading: false,
  pendingAppleFullName: null,
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  updateProfile: async () => null,
  signInWithGoogle: async () => null,
  signInWithProvider: async () => null,
  resetPasswordForEmail: async () => null,
  linkGoogle: async () => null,
  linkIdentity: async () => null,
  unlinkIdentity: async () => null,
  signOut: async () => undefined,
  deleteAccount: async () => null,
  providerState: { apple: 'connected' as const, google: 'connected' as const },
  reconnectProvider: async () => null,
  authBootstrapping: false,
  mfaRequired: false,
  setMfaRequired: () => undefined,
} as ReturnType<typeof useAuth>

function makePostLikeMutation(userId: string, postId = 'post-1') {
  return { kind: 'post_like' as const, userId, updatedAt: new Date().toISOString(), retryCount: 0, postId, targetState: true }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <ConnectivityProvider>{children}</ConnectivityProvider>
}

describe('ConnectivityContext flush behaviour', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedNetworkListener = null
    mockUseAuth.mockReturnValue(fakeAuthContext)
    mockGetNetworkStateAsync.mockResolvedValue({ type: Network.NetworkStateType.UNKNOWN })
    mockGetSession.mockResolvedValue({ access_token: 'tok' } as Awaited<ReturnType<typeof getSession>>)
    mockReadDeferredMutations.mockResolvedValue([])
    mockExecuteDeferredMutation.mockResolvedValue(undefined)
    mockRemoveDeferredMutation.mockResolvedValue(undefined)
  })

  it('blocks flush when session is expired (no active session)', async () => {
    mockGetSession.mockResolvedValue(null)
    mockReadDeferredMutations.mockResolvedValue([makePostLikeMutation('user-1')])

    renderHook(() => useConnectivity(), { wrapper })

    await act(async () => {
      capturedNetworkListener?.(ONLINE)
    })

    await waitFor(() => {
      expect(mockExecuteDeferredMutation).not.toHaveBeenCalled()
    })
  })

  it('skips mutations belonging to a different user mid-flush', async () => {
    // Queue has a mutation for user-2, but the logged-in user is user-1
    const wrongUserMutation = makePostLikeMutation('user-2')
    mockReadDeferredMutations.mockResolvedValue([wrongUserMutation])

    renderHook(() => useConnectivity(), { wrapper })

    await act(async () => {
      capturedNetworkListener?.(ONLINE)
    })

    await waitFor(() => {
      // readDeferredMutations was called (flush ran), but execute was skipped
      expect(mockReadDeferredMutations).toHaveBeenCalled()
      expect(mockExecuteDeferredMutation).not.toHaveBeenCalled()
    })
  })

  it('increments syncEpoch after a successful flush', async () => {
    mockReadDeferredMutations.mockResolvedValue([makePostLikeMutation('user-1')])

    const { result } = renderHook(() => useConnectivity(), { wrapper })

    // Drain the getNetworkStateAsync promise so it doesn't race with the listener below
    await act(async () => {})

    expect(result.current.syncEpoch).toBe(0)

    await act(async () => {
      capturedNetworkListener?.(ONLINE)
    })

    await waitFor(() => {
      expect(result.current.syncEpoch).toBeGreaterThan(0)
    })
  })

  it('does not start a second flush while one is already running (flushingRef guard)', async () => {
    let resolveFirst!: () => void
    const firstCallPromise = new Promise<void>(resolve => { resolveFirst = resolve })

    mockReadDeferredMutations.mockResolvedValue([makePostLikeMutation('user-1')])
    // First execute call blocks until we resolve it
    mockExecuteDeferredMutation
      .mockImplementationOnce(() => firstCallPromise)
      .mockResolvedValue(undefined)

    renderHook(() => useConnectivity(), { wrapper })

    // Drain the getNetworkStateAsync promise so it doesn't race with listener calls below
    await act(async () => {})

    // First trigger: flush starts and suspends at the slow executeDeferredMutation
    await act(async () => { capturedNetworkListener?.(ONLINE) })

    // Rapid offline/online while first flush is still in-flight (flushingRef guard should block second flush)
    act(() => { capturedNetworkListener?.(OFFLINE) })
    act(() => { capturedNetworkListener?.(ONLINE) })

    // Resolve the slow first mutation
    await act(async () => { resolveFirst() })

    await waitFor(() => {
      // executeDeferredMutation only ran for the first flush; the second was blocked by flushingRef
      expect(mockExecuteDeferredMutation).toHaveBeenCalledTimes(1)
    })
  })
})
