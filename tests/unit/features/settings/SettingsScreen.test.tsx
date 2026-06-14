import { fireEvent, render, screen } from '@testing-library/react-native'
import SettingsScreen from '@/features/settings/SettingsScreen'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSettings } from '@/lib/contexts/SettingsContext'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockUpdateSetting = jest.fn()
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

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/contexts/SettingsContext', () => ({
  useSettings: jest.fn(),
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
  }),
}))

jest.mock('@/lib/hooks/usePressScale', () => ({
  usePressScale: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}))

jest.mock('@/features/settings/PrivacyDataScreen', () => ({
  PRIVACY_POLICY_URL: 'https://rekkus.com/privacy',
  TERMS_URL: 'https://rekkus.com/terms',
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
  ChevronRight: () => null,
}))

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useAuth).mockReturnValue({
      user: { email: 'roy@example.com' },
      signOut: jest.fn(),
    } as never)
    jest.mocked(useSettings).mockReturnValue({
      settings: defaultSettings,
      loading: false,
      updateSetting: mockUpdateSetting,
    })
  })

  it('renders activity status setting and persists toggle changes', () => {
    render(<SettingsScreen />)

    fireEvent(screen.getByLabelText('Show activity status'), 'onValueChange', false)

    expect(screen.getByText('Show activity status')).toBeTruthy()
    expect(mockUpdateSetting).toHaveBeenCalledWith('show_activity_status', false)
  })
})
