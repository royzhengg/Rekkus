import { act, render, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import React, { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { analytics } from '@/lib/analytics'
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext'
import * as AuthService from '@/lib/services/auth'
import type { AuthUser } from '@/lib/services/auth'
import * as ProviderStorage from '@/lib/services/auth/providerStorage'
import * as UsersService from '@/lib/services/users'

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(),
  getRandomBytes: jest.fn(),
}))

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}))

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'rekkus://auth/callback'),
}))

jest.mock('@/lib/services/auth', () => ({
  getSession: jest.fn(),
  getCurrentUser: jest.fn(),
  subscribeToAuthStateChange: jest.fn(),
  signInWithIdToken: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  recordAuthAuditEvent: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  beginOAuthSignIn: jest.fn(),
  restoreSessionForOAuth: jest.fn(),
  beginOAuthLink: jest.fn(),
  linkIdentityWithIdToken: jest.fn(),
  unlinkIdentity: jest.fn(),
  refreshCurrentUserIdentities: jest.fn(),
}))

jest.mock('@/lib/services/auth/providerStorage', () => ({
  loadPersistedProviderState: jest.fn().mockResolvedValue(null),
  persistProviderState: jest.fn().mockResolvedValue(undefined),
  clearPersistedProviderState: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/services/users', () => ({
  fetchProfile: jest.fn(),
  updateProfile: jest.fn(),
}))

// Runs before every test (before describe-level beforeEach).
// clearAllMocks does NOT remove implementations, so these setup calls
// persist through each describe's jest.clearAllMocks().
beforeEach(() => {
  jest.mocked(AuthService.refreshCurrentUserIdentities).mockResolvedValue([])
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never)
})

jest.mock('@/lib/analytics', () => ({
  analytics: {
    loginOAuthStarted: jest.fn(),
    loginOAuthSuccess: jest.fn(),
    loginOAuthFailed: jest.fn(),
    onboardingStep: jest.fn(),
    onboardingAnomaly: jest.fn(),
    actionError: jest.fn(),
    accountLinked: jest.fn(),
    accountUnlinked: jest.fn(),
    providerRevoked: jest.fn(),
    providerReconnected: jest.fn(),
    providerReconnectFailed: jest.fn(),
  },
}))

type AuthContextValue = ReturnType<typeof useAuth>

function AuthHarness({ onValue }: { onValue: (value: AuthContextValue) => void }) {
  const value = useAuth()
  useEffect(() => {
    onValue(value)
  }, [onValue, value])
  return null
}

describe('AuthProvider Apple Sign-In', () => {
  const signedInUser = { id: 'user-1', identities: [{ provider: 'apple' }] } as AuthUser
  const appleFullName = {
    givenName: 'Roy',
    middleName: null,
    familyName: 'Zheng',
    namePrefix: null,
    nameSuffix: null,
    nickname: null,
  }
  function appleCredential(identityToken: string | null): AppleAuthentication.AppleAuthenticationCredential {
    return {
      authorizationCode: null,
      email: null,
      fullName: appleFullName,
      identityToken,
      realUserStatus: 1,
      state: null,
      user: 'apple-user',
    }
  }
  const mockAppleIsAvailableAsync = jest.mocked(AppleAuthentication.isAvailableAsync)
  const mockAppleSignInAsync = jest.mocked(AppleAuthentication.signInAsync)
  const mockDigestStringAsync = jest.mocked(Crypto.digestStringAsync)
  const mockGetRandomBytes = jest.mocked(Crypto.getRandomBytes)
  const mockGetSession = jest.mocked(AuthService.getSession)
  const mockGetCurrentUser = jest.mocked(AuthService.getCurrentUser)
  const mockSignInWithIdToken = jest.mocked(AuthService.signInWithIdToken)
  const mockFetchProfile = jest.mocked(UsersService.fetchProfile)
  const mockUpdateProfile = jest.mocked(UsersService.updateProfile)
  const mockSubscribeToAuthStateChange = jest.mocked(AuthService.subscribeToAuthStateChange)
  const mockOnboardingAnomaly = jest.mocked(analytics.onboardingAnomaly)

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    jest.mocked(AuthService.refreshCurrentUserIdentities).mockResolvedValue([])
    mockAppleIsAvailableAsync.mockResolvedValue(true)
    mockGetRandomBytes.mockReturnValue(new Uint8Array(Array.from({ length: 32 }, (_, index) => index)))
    mockDigestStringAsync.mockImplementation(async (_algorithm: string, value: string) => `hashed:${value}`)
    mockAppleSignInAsync.mockResolvedValue(appleCredential('apple-id-token'))
    mockGetSession.mockResolvedValue(null)
    mockGetCurrentUser.mockResolvedValue(signedInUser)
    mockSignInWithIdToken.mockResolvedValue(null)
    mockFetchProfile.mockResolvedValue({
      username: '',
      full_name: null,
      bio: null,
      avatar_url: null,
      suburb: null,
      city: null,
      country: null,
    })
    mockUpdateProfile.mockResolvedValue(undefined)
    mockSubscribeToAuthStateChange.mockReturnValue(jest.fn())
  })

  async function renderAuth() {
    let authValue: AuthContextValue | null = null
    render(
      <AuthProvider>
        <AuthHarness onValue={value => { authValue = value }} />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(authValue?.loading).toBe(false)
    })
    if (!authValue) throw new Error('Auth context did not render')
    return () => authValue as AuthContextValue
  }

  it('sends hashed nonce to Apple and raw nonce to Supabase', async () => {
    const getAuth = await renderAuth()

    await act(async () => {
      await getAuth().signInWithProvider('apple')
    })

    const rawNonce = '0123456789ABCDEFGHIJKLMNOPQRSTUV'
    expect(mockAppleSignInAsync).toHaveBeenCalledWith({
      nonce: `hashed:${rawNonce}`,
      requestedScopes: [0, 1],
    })
    expect(mockSignInWithIdToken).toHaveBeenCalledWith('apple', 'apple-id-token', rawNonce)
  })

  it('persists Apple full name when the profile has no display name', async () => {
    const getAuth = await renderAuth()

    await act(async () => {
      await getAuth().signInWithProvider('apple')
    })

    expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', { full_name: 'Roy Zheng' })
  })

  it('preserves an existing display name when Apple returns a full name', async () => {
    mockFetchProfile.mockResolvedValue({
      username: 'roy',
      full_name: 'Roy',
      bio: null,
      avatar_url: null,
      suburb: null,
      city: null,
      country: null,
    })
    const getAuth = await renderAuth()

    await act(async () => {
      await getAuth().signInWithProvider('apple')
    })

    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('continues sign-in and stores pending Apple full name when profile persistence fails', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('temporary failure'))
    const getAuth = await renderAuth()

    let error: string | null = 'not-run'
    await act(async () => {
      error = await getAuth().signInWithProvider('apple')
    })

    expect(error).toBeNull()
    await waitFor(() => {
      expect(getAuth().pendingAppleFullName).toBe('Roy Zheng')
    })
    expect(mockOnboardingAnomaly).toHaveBeenCalledWith('user-1', 'login_apple', 'profile_name_persist_failed')
  })

  it('treats Apple cancellation as a non-error without calling Supabase', async () => {
    mockAppleSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' })
    const getAuth = await renderAuth()

    let error: string | null = 'not-run'
    await act(async () => {
      error = await getAuth().signInWithProvider('apple')
    })

    expect(error).toBeNull()
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })

  it('returns a routine error when Apple omits the identity token', async () => {
    mockAppleSignInAsync.mockResolvedValue(appleCredential(null))
    const getAuth = await renderAuth()

    let error: string | null = null
    await act(async () => {
      error = await getAuth().signInWithProvider('apple')
    })

    expect(error).toBe('Apple did not return an identity token.')
    expect(mockSignInWithIdToken).not.toHaveBeenCalled()
  })
})

describe('AuthProvider — provider revocation state', () => {
  const mockRefreshIdentities = jest.mocked(AuthService.refreshCurrentUserIdentities)
  const mockLoadPersisted = jest.mocked(ProviderStorage.loadPersistedProviderState)
  const mockPersist = jest.mocked(ProviderStorage.persistProviderState)
  const mockClear = jest.mocked(ProviderStorage.clearPersistedProviderState)
  const mockGetSession = jest.mocked(AuthService.getSession)
  const mockSubscribe = jest.mocked(AuthService.subscribeToAuthStateChange)
  const mockBeginOAuthLink = jest.mocked(AuthService.beginOAuthLink)
  const mockProviderRevoked = jest.mocked(analytics.providerRevoked)
  const mockProviderReconnected = jest.mocked(analytics.providerReconnected)
  const mockProviderReconnectFailed = jest.mocked(analytics.providerReconnectFailed)

  let capturedAuth: ReturnType<typeof useAuth> | null = null

  function Harness() {
    const auth = useAuth()
    useEffect(() => { capturedAuth = auth }, [auth])
    return null
  }

  function renderAuth() {
    capturedAuth = null
    const result = render(<AuthProvider><Harness /></AuthProvider>)
    return {
      getAuth: () => capturedAuth!,
      unmount: result.unmount,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedAuth = null
    mockGetSession.mockResolvedValue(null)
    mockSubscribe.mockReturnValue(() => {})
    mockRefreshIdentities.mockResolvedValue([])
    mockLoadPersisted.mockResolvedValue(null)
    mockPersist.mockResolvedValue(undefined)
    mockClear.mockResolvedValue(undefined)
  })

  it('initialises providerState as all connected (no known revocations)', async () => {
    renderAuth()
    await waitFor(() => expect(capturedAuth?.providerState).toBeDefined())
    expect(capturedAuth!.providerState.google).toBe('connected')
    expect(capturedAuth!.providerState.apple).toBe('connected')
  })

  it('loads cached provider state on startup', async () => {
    mockLoadPersisted.mockResolvedValue({ google: 'revoked', apple: 'connected' })
    // Refresh returns apple only → google stays revoked (cache), apple stays connected (present in fresh)
    const appleId = { id: 'i', provider: 'apple', user_id: 'u', identity_id: 'ii', identity_data: {}, created_at: '', updated_at: '', last_sign_in_at: '' }
    mockRefreshIdentities.mockResolvedValue([appleId as never])
    renderAuth()
    await waitFor(() => expect(capturedAuth?.providerState.google).toBe('revoked'))
    expect(capturedAuth!.providerState.apple).toBe('connected')
  })

  it('refreshes identities on startup and marks absent providers as revoked', async () => {
    const googleIdentity = {
      id: 'id-g',
      provider: 'google',
      user_id: 'u1',
      identity_id: 'ig',
      identity_data: {},
      created_at: '',
      updated_at: '',
      last_sign_in_at: '',
    }
    mockRefreshIdentities.mockResolvedValue([googleIdentity as never])
    renderAuth()
    await waitFor(() => expect(capturedAuth?.providerState.apple).toBe('revoked'))
    expect(capturedAuth!.providerState.google).toBe('connected')
  })

  it('does not fire providerRevoked analytics on revoked → revoked (no transition)', async () => {
    mockLoadPersisted.mockResolvedValue({ google: 'revoked', apple: 'connected' })
    mockRefreshIdentities.mockResolvedValue([])
    renderAuth()
    await waitFor(() => expect(capturedAuth?.providerState.apple).toBe('revoked'))
    // google was already revoked in cache — must not re-fire
    const googleRevocations = mockProviderRevoked.mock.calls.filter(([, p]) => p === 'google')
    expect(googleRevocations.length).toBe(0)
  })

  it('does not change state when refreshCurrentUserIdentities returns null (network failure)', async () => {
    mockLoadPersisted.mockResolvedValue({ google: 'revoked', apple: 'connected' })
    mockRefreshIdentities.mockResolvedValue(null)
    renderAuth()
    // google stays revoked (from cache); null fresh leaves state unchanged
    await waitFor(() => expect(capturedAuth?.providerState.google).toBe('revoked'))
    expect(capturedAuth!.providerState.apple).toBe('connected')
  })

  it('in-flight guard: AppState event storm fires only one network call per throttle window', async () => {
    const listeners: Array<(state: string) => void> = []
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      listeners.push(cb as (state: string) => void)
      return { remove: jest.fn() }
    })

    renderAuth()
    // Wait for startup refresh (force=true, bypasses throttle)
    await waitFor(() => expect(mockRefreshIdentities).toHaveBeenCalledTimes(1))

    // Fire 5 rapid active events — all within throttle window
    await act(async () => {
      for (let i = 0; i < 5; i++) listeners.forEach(l => l('active'))
    })

    // Still only 1 call — throttle blocks the rest
    expect(mockRefreshIdentities).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('signOut clears persisted provider state', async () => {
    renderAuth()
    await waitFor(() => expect(capturedAuth).not.toBeNull())
    await act(async () => { await capturedAuth!.signOut() })
    expect(mockClear).toHaveBeenCalled()
  })

  it('reconnectProvider failure: state stays revoked and fires providerReconnectFailed', async () => {
    mockLoadPersisted.mockResolvedValue({ google: 'revoked', apple: 'connected' })
    // beginOAuthLink fails
    mockBeginOAuthLink.mockResolvedValue({ url: null, error: 'OAuth provider error' })

    renderAuth()
    await waitFor(() => expect(capturedAuth?.providerState.google).toBe('revoked'))

    await act(async () => {
      await capturedAuth!.reconnectProvider('google')
    })

    expect(capturedAuth!.providerState.google).toBe('revoked')
    expect(mockProviderReconnectFailed).toHaveBeenCalledWith(
      null, 'google', expect.any(String)
    )
    expect(mockProviderReconnected).not.toHaveBeenCalled()
  })
})
