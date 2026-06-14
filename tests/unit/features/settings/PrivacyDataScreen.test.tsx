import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import PrivacyDataScreen from '@/features/settings/PrivacyDataScreen'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { submitPrivacyRequest } from '@/lib/services/privacyRequests'

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockDeleteAccount = jest.fn()
const mockShowToast = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/lib/contexts/ToastContext', () => ({
  useToast: jest.fn(),
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    bg: '#ffffff',
    border: '#dddddd',
    surface: '#f8f8f8',
    text: '#111111',
    text2: '#333333',
    text3: '#666666',
    errorBg: '#ffeeee',
    errorText: '#990000',
  }),
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => null,
  ChevronRight: () => null,
}))

jest.mock('@/components/ui/RekkusActionSheet', () => ({
  RekkusActionSheet: ({
    visible,
    options,
    onSelect,
  }: {
    visible: boolean
    options: Array<{ label: string; value: string }>
    onSelect: (value: string) => void
  }) => {
    const { Text, TouchableOpacity } = jest.requireActual('react-native')
    return visible ? (
      <>
        {options.map(option => (
          <TouchableOpacity key={option.value} onPress={() => onSelect(option.value)} accessibilityRole="button">
            <Text>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </>
    ) : null
  },
}))

jest.mock('@/lib/services/privacyRequests', () => ({
  submitPrivacyRequest: jest.fn(),
}))

describe('PrivacyDataScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      deleteAccount: mockDeleteAccount,
    } as never)
    jest.mocked(useToast).mockReturnValue({ showToast: mockShowToast })
    jest.mocked(submitPrivacyRequest).mockResolvedValue(undefined)
    mockDeleteAccount.mockResolvedValue(null)
  })

  it('submits tracked privacy requests from settings', async () => {
    render(<PrivacyDataScreen />)

    fireEvent.press(screen.getByText('Request data export'))

    await waitFor(() => {
      expect(submitPrivacyRequest).toHaveBeenCalledWith('user-1', 'export')
    })
    expect(mockShowToast).toHaveBeenCalledWith('Privacy request submitted', expect.objectContaining({ title: 'Request received' }))
  })

  it('requires explicit confirmation before self-serve account deletion', async () => {
    render(<PrivacyDataScreen />)

    fireEvent.press(screen.getByText('Delete account now'))
    expect(mockDeleteAccount).not.toHaveBeenCalled()

    fireEvent.press(screen.getByText('Delete account'))

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1)
    })
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed')
  })
})
