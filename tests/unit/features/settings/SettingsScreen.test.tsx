import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Alert, Platform, type AlertButton } from 'react-native'
import AppearancePlaybackSettingsScreen from '@/features/settings/AppearancePlaybackSettingsScreen'
import ConnectedAccountsScreen from '@/features/settings/ConnectedAccountsScreen'
import NotificationsSettingsScreen from '@/features/settings/NotificationsSettingsScreen'
import PrivacySocialSettingsScreen from '@/features/settings/PrivacySocialSettingsScreen'
import SettingsScreen from '@/features/settings/SettingsScreen'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchProfile } from '@/lib/services/users'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockUpdateSetting = jest.fn()
const mockSignOut = jest.fn()
const mockLinkIdentity = jest.fn()
const mockUnlinkIdentity = jest.fn()
const defaultSettings = {
  notif_likes: true,
  notif_comments: true,
  notif_followers: true,
  notif_mentions: true,
  notif_messages: true,
  private_account: false,
  allow_comments: true,
  allow_tags: true,
  show_activity_status: true,
  autoplay_videos: true,
  theme_mode: 'system' as const,
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}))

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/contexts/SettingsContext', () => ({
  useSettings: jest.fn(),
}))

const mockRequireOnline = jest.fn()

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ requireOnline: mockRequireOnline }),
}))

jest.mock('@/lib/services/users', () => ({
  fetchProfile: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    actionError: jest.fn(),
  },
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    accent: '#000000',
    bg: '#ffffff',
    border: '#dddddd',
    border2: '#cccccc',
    surface: '#f8f8f8',
    surface2: '#eeeeee',
    text: '#111111',
    text2: '#333333',
    text3: '#666666',
    white: '#ffffff',
  }),
}))

jest.mock('@/lib/hooks/usePressScale', () => ({
  usePressScale: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}))

jest.mock('@/components/ui/CachedImage', () => ({
  CachedImage: () => null,
}))

jest.mock('@/features/settings/PrivacyDataScreen', () => ({
  PRIVACY_POLICY_URL: 'https://rekkus.com/privacy',
  TERMS_URL: 'https://rekkus.com/terms',
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
  BellIcon: () => null,
  CheckIcon: () => null,
  ChevronRight: () => null,
  EyeIcon: () => null,
  ListIcon: () => null,
  LockIcon: () => null,
  MapPinIcon: () => null,
  MessageIcon: () => null,
  SaveIcon: () => null,
  TagIcon: () => null,
  UserIcon: () => null,
  VideoIcon: () => null,
}))

describe('Settings screens', () => {
  const originalPlatform = Platform.OS
  const mockIsAppleAvailableAsync = jest.mocked(AppleAuthentication.isAvailableAsync)

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
    mockRequireOnline.mockReturnValue(true)
    mockLinkIdentity.mockResolvedValue(null)
    mockUnlinkIdentity.mockResolvedValue(null)
    mockIsAppleAvailableAsync.mockResolvedValue(false)
    jest.mocked(fetchProfile).mockResolvedValue({
      username: 'roy',
      full_name: 'Roy Zheng',
      bio: null,
      avatar_url: null,
      suburb: null,
      city: null,
      country: null,
    })
    mockSignOut.mockResolvedValue(undefined)
    jest.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        email: 'roy@example.com',
        identities: [
          { provider: 'email', identity_data: { email: 'roy@example.com' } },
          { provider: 'google', identity_data: { email: 'roy@gmail.com' } },
        ],
      },
      signOut: mockSignOut,
      linkIdentity: mockLinkIdentity,
      unlinkIdentity: mockUnlinkIdentity,
      providerState: { apple: 'connected' as const, google: 'connected' as const },
      reconnectProvider: jest.fn(),
    } as never)
    jest.mocked(useSettings).mockReturnValue({
      settings: defaultSettings,
      loading: false,
      updateSetting: mockUpdateSetting,
      updatePrivateAccountSetting: jest.fn(),
    })
  })

  it('renders the settings hub and navigates to routed subpages', async () => {
    render(<SettingsScreen />)

    expect(await screen.findByText('Roy Zheng')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Notifications, On'))
    expect(mockPush).toHaveBeenCalledWith('/settings/notifications')

    fireEvent.press(screen.getByLabelText('Privacy and social, Public'))
    expect(mockPush).toHaveBeenCalledWith('/settings/privacy-social')

    fireEvent.press(screen.getByLabelText('Appearance and playback, System'))
    expect(mockPush).toHaveBeenCalledWith('/settings/appearance-playback')

    fireEvent.press(screen.getByLabelText('Connected accounts, Email, Google'))
    expect(mockPush).toHaveBeenCalledWith('/settings/connected-accounts')
  })

  it('keeps planned rows inert on the settings hub', async () => {
    render(<SettingsScreen />)

    expect(await screen.findByText('Roy Zheng')).toBeTruthy()

    fireEvent.press(screen.getByText('Taste profile'))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('requires destructive confirmation before signing out', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    render(<SettingsScreen />)

    fireEvent.press(screen.getByLabelText('Sign out, End session'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out?',
      'You can return by signing in again.',
      expect.any(Array),
    )
    expect(mockSignOut).not.toHaveBeenCalled()

    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButton[] | undefined
    await act(async () => {
      buttons?.[1]?.onPress?.()
    })

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed')
    })

    alertSpy.mockRestore()
  })

  it('updates notification settings from inline switches', () => {
    render(<NotificationsSettingsScreen />)

    fireEvent.press(screen.getByLabelText('Likes'))
    fireEvent.press(screen.getByLabelText('Messages'))

    expect(mockUpdateSetting).toHaveBeenCalledWith('notif_likes', false)
    expect(mockUpdateSetting).toHaveBeenCalledWith('notif_messages', false)
  })

  it('updates privacy and social settings from inline switches', () => {
    render(<PrivacySocialSettingsScreen />)

    fireEvent.press(screen.getByLabelText('Private account'))
    fireEvent.press(screen.getByLabelText('Allow comments'))
    fireEvent.press(screen.getByLabelText('Allow tags and mentions'))
    fireEvent.press(screen.getByLabelText('Activity visibility'))

    expect(mockUpdateSetting).toHaveBeenCalledWith('private_account', true)
    expect(mockUpdateSetting).toHaveBeenCalledWith('allow_comments', false)
    expect(mockUpdateSetting).toHaveBeenCalledWith('allow_tags', false)
    expect(mockUpdateSetting).toHaveBeenCalledWith('show_activity_status', false)
  })

  it('updates appearance and playback settings without a bottom sheet', () => {
    render(<AppearancePlaybackSettingsScreen />)

    fireEvent.press(screen.getByLabelText('Dark'))
    fireEvent.press(screen.getByLabelText('Autoplay videos'))

    expect(mockUpdateSetting).toHaveBeenCalledWith('theme_mode', 'dark')
    expect(mockUpdateSetting).toHaveBeenCalledWith('autoplay_videos', false)
  })

  it('shows restored Apple identities from Supabase user identities', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    jest.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        email: 'roy@example.com',
        identities: [
          { provider: 'email', identity_data: { email: 'roy@example.com' } },
          { provider: 'apple', identity_data: { email: 'relay@privaterelay.appleid.com' } },
        ],
      },
      linkIdentity: mockLinkIdentity,
      unlinkIdentity: mockUnlinkIdentity,
      providerState: { apple: 'connected' as const, google: 'connected' as const },
      reconnectProvider: jest.fn(),
    } as never)

    render(<ConnectedAccountsScreen />)

    expect(await screen.findByText('Apple')).toBeTruthy()
    expect(screen.getByText('relay@privaterelay.appleid.com')).toBeTruthy()
    expect(screen.queryByLabelText('Connect Apple')).toBeNull()
  })

  it('uses provider-agnostic linking for Apple', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockIsAppleAvailableAsync.mockResolvedValue(true)

    render(<ConnectedAccountsScreen />)
    fireEvent.press(await screen.findByLabelText('Connect Apple'))

    await waitFor(() => {
      expect(mockLinkIdentity).toHaveBeenCalledWith('apple')
    })
  })

  it('blocks duplicate connect taps while a provider is pending', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockIsAppleAvailableAsync.mockResolvedValue(true)
    let resolveLink: (value: string | null) => void = () => {}
    mockLinkIdentity.mockImplementation(() => new Promise(resolve => {
      resolveLink = resolve
    }))

    render(<ConnectedAccountsScreen />)
    const appleButton = await screen.findByLabelText('Connect Apple')
    fireEvent.press(appleButton)
    fireEvent.press(appleButton)

    expect(mockLinkIdentity).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveLink(null)
    })
  })

  it('prevents unlinking the final Apple sign-in method', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
    jest.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        email: 'relay@privaterelay.appleid.com',
        identities: [
          { provider: 'apple', identity_data: { email: 'relay@privaterelay.appleid.com' } },
        ],
      },
      linkIdentity: mockLinkIdentity,
      unlinkIdentity: mockUnlinkIdentity,
      providerState: { apple: 'connected' as const, google: 'connected' as const },
      reconnectProvider: jest.fn(),
    } as never)

    render(<ConnectedAccountsScreen />)
    fireEvent.press(await screen.findByLabelText('Disconnect Apple'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Cannot disconnect',
      'Apple is your only sign-in method. Add another sign-in method before disconnecting.'
    )
    expect(mockUnlinkIdentity).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})
