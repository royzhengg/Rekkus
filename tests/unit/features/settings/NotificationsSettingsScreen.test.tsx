import { fireEvent, render, screen } from '@testing-library/react-native'
import NotificationsSettingsScreen from '@/features/settings/NotificationsSettingsScreen'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useFeatureFlag } from '@/lib/featureFlags'

const mockBack = jest.fn()
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
  useRouter: () => ({ back: mockBack }),
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
    white: '#ffffff',
  }),
}))

jest.mock('@/lib/featureFlags', () => ({
  useFeatureFlag: jest.fn((flag: string) => flag === 'mentionNotifications'),
}))

jest.mock('@/lib/hooks/usePressScale', () => ({
  usePressScale: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
}))

describe('NotificationsSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useSettings).mockReturnValue({
      settings: defaultSettings,
      loading: false,
      updateSetting: mockUpdateSetting,
      updatePrivateAccountSetting: jest.fn(),
    })
  })

  describe('renders all rows', () => {
    it('renders Likes row with correct sublabel', () => {
      render(<NotificationsSettingsScreen />)
      expect(screen.getByText('Likes')).toBeTruthy()
      expect(screen.getByText('When people like your posts')).toBeTruthy()
    })

    it('renders Comments and replies row with correct sublabel', () => {
      render(<NotificationsSettingsScreen />)
      expect(screen.getByText('Comments and replies')).toBeTruthy()
      expect(screen.getByText('New comments on your posts')).toBeTruthy()
    })

    it('renders New followers row with correct sublabel', () => {
      render(<NotificationsSettingsScreen />)
      expect(screen.getByText('New followers')).toBeTruthy()
      expect(screen.getByText('When someone follows you')).toBeTruthy()
    })

    it('renders Mentions row with updated label and sublabel (not "Mentions and tags")', () => {
      render(<NotificationsSettingsScreen />)
      expect(screen.getByText('Mentions')).toBeTruthy()
      expect(screen.queryByText('Mentions and tags')).toBeNull()
      expect(screen.getByText('When someone mentions you in a post or comment')).toBeTruthy()
    })

    it('renders Messages row with correct sublabel', () => {
      render(<NotificationsSettingsScreen />)
      expect(screen.getByText('Messages')).toBeTruthy()
      expect(screen.getByText('Direct message notifications')).toBeTruthy()
    })
  })

  describe('toggle → updateSetting', () => {
    it('toggling Likes calls updateSetting with notif_likes false', () => {
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('Likes'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_likes', false)
    })

    it('toggling Comments and replies calls updateSetting with notif_comments false', () => {
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('Comments and replies'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_comments', false)
    })

    it('toggling New followers calls updateSetting with notif_followers false', () => {
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('New followers'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_followers', false)
    })

    it('toggling Mentions calls updateSetting with notif_mentions false', () => {
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('Mentions'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_mentions', false)
    })

    it('toggling Messages calls updateSetting with notif_messages false', () => {
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('Messages'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_messages', false)
    })

    it('toggling an OFF switch calls updateSetting with true', () => {
      jest.mocked(useSettings).mockReturnValue({
        settings: { ...defaultSettings, notif_likes: false },
        loading: false,
        updateSetting: mockUpdateSetting,
        updatePrivateAccountSetting: jest.fn(),
      })
      render(<NotificationsSettingsScreen />)
      fireEvent.press(screen.getByLabelText('Likes'))
      expect(mockUpdateSetting).toHaveBeenCalledWith('notif_likes', true)
    })
  })

  it('hides Mentions row when mentionNotifications flag is off', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false)
    render(<NotificationsSettingsScreen />)
    expect(screen.queryByText('Mentions')).toBeNull()
  })

  it('renders the footer note about device-level permissions', () => {
    render(<NotificationsSettingsScreen />)
    expect(
      screen.getByText('Device-level notification permissions are controlled by your phone settings.')
    ).toBeTruthy()
  })
})
