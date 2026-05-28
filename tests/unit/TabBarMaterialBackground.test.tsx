import { render } from '@testing-library/react-native'
import { Platform, View } from 'react-native'
import { TabBarMaterialBackground } from '@/components/ui/TabBarMaterialBackground'
import { useIsDarkMode } from '@/lib/contexts/ThemeContext'
import { useReduceTransparency } from '@/lib/hooks/useReduceTransparency'

jest.mock('expo-blur', () => ({
  BlurView: ({ testID }: { testID?: string }) => <View testID={testID} />,
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({ bg: '#FAFAF8' }),
  useIsDarkMode: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/hooks/useReduceTransparency', () => ({
  useReduceTransparency: jest.fn().mockReturnValue(false),
}))

const mockedReduceTransparency = jest.mocked(useReduceTransparency)
const mockedDarkMode = jest.mocked(useIsDarkMode)

describe('TabBarMaterialBackground', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockedReduceTransparency.mockReturnValue(false)
    mockedDarkMode.mockReturnValue(false)
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs })
  })

  it('renders material only when enabled on iOS', () => {
    const screen = render(<TabBarMaterialBackground materialEnabled />)
    expect(screen.getByTestId('tab-bar-material-background')).toBeTruthy()
    expect(screen.queryByTestId('tab-bar-opaque-background')).toBeNull()
  })

  it('renders the opaque fallback when disabled, non-iOS, or transparency is reduced', () => {
    const disabled = render(<TabBarMaterialBackground materialEnabled={false} />)
    expect(disabled.getByTestId('tab-bar-opaque-background')).toBeTruthy()
    disabled.unmount()

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const android = render(<TabBarMaterialBackground materialEnabled />)
    expect(android.getByTestId('tab-bar-opaque-background')).toBeTruthy()
    android.unmount()

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockedReduceTransparency.mockReturnValue(true)
    const reduced = render(<TabBarMaterialBackground materialEnabled />)
    expect(reduced.getByTestId('tab-bar-opaque-background')).toBeTruthy()
  })
})
