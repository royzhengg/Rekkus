import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'
import ConnectedAccountsScreen from '@/features/settings/ConnectedAccountsScreen'
import { useAuth } from '@/lib/contexts/AuthContext'
import type { ProviderStateRecord } from '@/lib/services/auth/providerState'

const mockBack = jest.fn()
const mockLinkIdentity = jest.fn()
const mockUnlinkIdentity = jest.fn()
const mockReconnectProvider = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}))

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockRequireOnline = jest.fn()
jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ requireOnline: mockRequireOnline }),
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    bg: '#ffffff',
    border: '#dddddd',
    surface: '#f8f8f8',
    surface2: '#eeeeee',
    text: '#111111',
    text2: '#333333',
    text3: '#666666',
    liked: '#ff4444',
    info: '#0066cc',
  }),
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
}))

const baseProviderState: ProviderStateRecord = { google: 'connected', apple: 'connected' }

function makeUser(providers: string[], providerState = baseProviderState) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    identities: providers.map(p => ({
      id: `id-${p}`,
      provider: p,
      identity_data: { email: `${p}@example.com` },
      user_id: 'user-1',
      identity_id: `identity-${p}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
    })),
    providerState,
  }
}

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  jest.mocked(useAuth).mockReturnValue({
    user: makeUser(['email', 'google']),
    session: null,
    loading: false,
    pendingAppleFullName: null,
    providerState: baseProviderState,
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    updateProfile: jest.fn(),
    signInWithGoogle: jest.fn(),
    signInWithProvider: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    linkGoogle: jest.fn(),
    linkIdentity: mockLinkIdentity,
    unlinkIdentity: mockUnlinkIdentity,
    reconnectProvider: mockReconnectProvider,
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    ...overrides,
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireOnline.mockReturnValue(true)
  mockLinkIdentity.mockResolvedValue(null)
  mockUnlinkIdentity.mockResolvedValue(null)
  mockReconnectProvider.mockResolvedValue(null)
  jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(false)
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
})

describe('ConnectedAccountsScreen — normal states', () => {
  it('shows Disconnect for connected providers', async () => {
    mockAuth()
    render(<ConnectedAccountsScreen />)
    expect(await screen.findByLabelText('Disconnect Google')).toBeTruthy()
  })

  it('shows Connect for unlinked Google when it is unlinked', async () => {
    mockAuth({
      user: makeUser(['email']) as never,
      providerState: baseProviderState,
    })
    render(<ConnectedAccountsScreen />)
    expect(await screen.findByLabelText('Connect Google')).toBeTruthy()
  })
})

describe('ConnectedAccountsScreen — revoked state', () => {
  it('shows Reconnect button when Google identity is present AND state is revoked', async () => {
    const revokedState: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    mockAuth({
      user: makeUser(['email', 'google']) as never,
      providerState: revokedState,
    })
    render(<ConnectedAccountsScreen />)
    expect(await screen.findByLabelText('Reconnect Google')).toBeTruthy()
    expect(await screen.findByText('Disconnected outside Rekkus')).toBeTruthy()
  })

  it('does NOT show Reconnect when identity is absent (intentionally disconnected)', async () => {
    const revokedState: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    mockAuth({
      user: makeUser(['email']) as never,   // Google identity removed
      providerState: revokedState,
    })
    render(<ConnectedAccountsScreen />)
    await screen.findByText('Connected accounts')
    expect(screen.queryByLabelText('Reconnect Google')).toBeNull()
    expect(screen.queryByText('Disconnected outside Rekkus')).toBeNull()
    // Should show Connect instead
    expect(await screen.findByLabelText('Connect Google')).toBeTruthy()
  })

  it('calls reconnectProvider when Reconnect is tapped', async () => {
    const revokedState: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    mockAuth({
      user: makeUser(['email', 'google']) as never,
      providerState: revokedState,
    })
    render(<ConnectedAccountsScreen />)
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('Reconnect Google'))
    })
    await waitFor(() => {
      expect(mockReconnectProvider).toHaveBeenCalledWith('google')
    })
  })

  it('shows offline error when Reconnect tapped without network', async () => {
    mockRequireOnline.mockReturnValue(false)
    const revokedState: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    mockAuth({
      user: makeUser(['email', 'google']) as never,
      providerState: revokedState,
    })
    render(<ConnectedAccountsScreen />)
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('Reconnect Google'))
    })
    expect(await screen.findByText('Reconnect to re-link your account.')).toBeTruthy()
    expect(mockReconnectProvider).not.toHaveBeenCalled()
  })
})

describe('ConnectedAccountsScreen — connecting state', () => {
  it('shows spinner when state is connecting', async () => {
    const connectingState: ProviderStateRecord = { google: 'connecting', apple: 'connected' }
    mockAuth({
      user: makeUser(['email', 'google']) as never,
      providerState: connectingState,
    })
    render(<ConnectedAccountsScreen />)
    await screen.findByText('Connected accounts')
    // Spinner shown instead of Reconnect/Disconnect
    expect(screen.queryByLabelText('Reconnect Google')).toBeNull()
    expect(screen.queryByLabelText('Disconnect Google')).toBeNull()
  })
})

describe('ConnectedAccountsScreen — startup sequence', () => {
  it('cache=revoked + identity present: reconnect prompt visible', async () => {
    const revokedState: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    mockAuth({
      user: makeUser(['email', 'google']) as never,
      providerState: revokedState,
    })
    render(<ConnectedAccountsScreen />)
    expect(await screen.findByLabelText('Reconnect Google')).toBeTruthy()
  })
})
