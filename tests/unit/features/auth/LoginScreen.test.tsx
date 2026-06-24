import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'
import LoginScreen from '@/features/auth/LoginScreen'
import { getCurrentUser } from '@/lib/services/auth'
import { fetchProfile } from '@/lib/services/users'

// ── module mocks ──────────────────────────────────────────────────────────────

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
}))

jest.mock('expo-apple-authentication', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native')
  return {
    isAvailableAsync: jest.fn(),
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { BLACK: 2 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue with Apple" onPress={onPress}>
        <Text>Continue with Apple</Text>
      </TouchableOpacity>
    ),
  }
})

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native')
  return { SafeAreaView: View }
})

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native')
  return {
    Svg: View, Polyline: View, Path: View, Circle: View,
  }
})

jest.mock('@/components/icons', () => ({
  AppleIcon: () => null,
}))

jest.mock('@/components/ui/ErrorMessage', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    ErrorMessage: ({ message }: { message: string }) => <Text testID="error-message">{message}</Text>,
  }
})

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

const mockSignInWithEmail = jest.fn()
const mockSignInWithProvider = jest.fn()

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    signInWithProvider: mockSignInWithProvider,
  }),
}))

const mockRequireOnline = jest.fn(() => true)

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ requireOnline: mockRequireOnline }),
}))

jest.mock('@/lib/services/auth', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
}))

jest.mock('@/lib/services/users', () => ({
  fetchProfile: jest.fn(() => Promise.resolve(null)),
}))

const mockGetCurrentUser = jest.mocked(getCurrentUser)
const mockFetchProfile = jest.mocked(fetchProfile)
const mockIsAppleAvailableAsync = jest.mocked(AppleAuthentication.isAvailableAsync)

// ── helpers ───────────────────────────────────────────────────────────────────

function fillForm(email = 'test@example.com', password = 'password123') {
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email)
  fireEvent.changeText(screen.getByPlaceholderText('Password'), password)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    mockRequireOnline.mockReturnValue(true)
    mockSignInWithEmail.mockResolvedValue(null)
    mockSignInWithProvider.mockResolvedValue(null)
    mockIsAppleAvailableAsync.mockResolvedValue(false)
    mockGetCurrentUser.mockResolvedValue(null as never)
    mockFetchProfile.mockResolvedValue(null)
  })

  it('sign in button is disabled when email is empty', () => {
    render(<LoginScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123')
    const btn = screen.getByRole('button', { name: 'Sign in' })
    expect(btn).toBeDisabled()
  })

  it('sign in button is disabled when password is too short', () => {
    render(<LoginScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'short')
    const btn = screen.getByRole('button', { name: 'Sign in' })
    expect(btn).toBeDisabled()
  })

  it('sign in button is enabled with valid email and password', () => {
    render(<LoginScreen />)
    fillForm()
    const btn = screen.getByRole('button', { name: 'Sign in' })
    expect(btn).not.toBeDisabled()
  })

  it('shows offline error without calling sign in service', async () => {
    mockRequireOnline.mockReturnValue(false)
    render(<LoginScreen />)
    fillForm()
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeTruthy()
      expect(screen.getByText('Reconnect to sign in.')).toBeTruthy()
    })
    expect(mockSignInWithEmail).not.toHaveBeenCalled()
  })

  it('displays service error returned by signInWithEmail', async () => {
    mockSignInWithEmail.mockResolvedValue('Invalid email or password.')
    render(<LoginScreen />)
    fillForm()
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeTruthy()
    })
  })

  it('navigates to feed on successful sign in', async () => {
    mockSignInWithEmail.mockResolvedValue(null)
    render(<LoginScreen />)
    fillForm()
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed')
    })
  })

  it('calls signInWithEmail with trimmed email', async () => {
    render(<LoginScreen />)
    fillForm('  test@example.com  ', 'password123')
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('shows Apple sign in on iOS when Apple authentication is available', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockIsAppleAvailableAsync.mockResolvedValue(true)

    render(<LoginScreen />)

    expect(await screen.findByRole('button', { name: 'Continue with Apple' })).toBeTruthy()
  })

  it('hides Apple sign in on iOS when Apple authentication is unavailable', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockIsAppleAvailableAsync.mockResolvedValue(false)

    render(<LoginScreen />)

    await waitFor(() => {
      expect(mockIsAppleAvailableAsync).toHaveBeenCalled()
    })
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull()
  })

  it('calls provider sign in for Google', async () => {
    render(<LoginScreen />)

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }))

    await waitFor(() => {
      expect(mockSignInWithProvider).toHaveBeenCalledWith('google')
    })
  })

  it('calls provider sign in for Apple and routes new users to onboarding', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockIsAppleAvailableAsync.mockResolvedValue(true)
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never)
    mockFetchProfile.mockResolvedValue({
      username: '',
      full_name: null,
      bio: null,
      avatar_url: null,
      suburb: null,
      city: null,
      country: null,
    })

    render(<LoginScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Continue with Apple' }))

    await waitFor(() => {
      expect(mockSignInWithProvider).toHaveBeenCalledWith('apple')
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding-profile')
    })
  })
})
