import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import LoginScreen from '@/features/auth/LoginScreen'

// ── module mocks ──────────────────────────────────────────────────────────────

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
}))

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
const mockSignInWithGoogle = jest.fn()
const mockSignInWithApple = jest.fn()

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithEmail: mockSignInWithEmail,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithApple: mockSignInWithApple,
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

// ── helpers ───────────────────────────────────────────────────────────────────

function fillForm(email = 'test@example.com', password = 'password123') {
  fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email)
  fireEvent.changeText(screen.getByPlaceholderText('Password'), password)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireOnline.mockReturnValue(true)
    mockSignInWithEmail.mockResolvedValue(null)
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
})
