import { render } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useReduceTransparency } from '@/lib/hooks/useReduceTransparency'

jest.mock('expo-blur', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    BlurView: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement(View, { testID }, children),
  }
})

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => require('@/constants/Colors').lightColors,
  useIsDarkMode: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/hooks/useReduceTransparency', () => ({
  useReduceTransparency: jest.fn().mockReturnValue(false),
}))

const mockedReduceTransparency = jest.mocked(useReduceTransparency)

describe('GlassSurface', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockedReduceTransparency.mockReturnValue(false)
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs })
  })

  it('uses material on eligible iOS surfaces', () => {
    const screen = render(
      <GlassSurface>
        <Text>Surface content</Text>
      </GlassSurface>
    )

    expect(screen.getByTestId('glass-surface-material')).toBeTruthy()
    expect(screen.getByText('Surface content')).toBeTruthy()
  })

  it('falls back when disabled, on Android, or Reduce Transparency is enabled', () => {
    const disabled = render(<GlassSurface materialEnabled={false} />)
    expect(disabled.getByTestId('glass-surface-fallback')).toBeTruthy()
    disabled.unmount()

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const android = render(<GlassSurface />)
    expect(android.getByTestId('glass-surface-fallback')).toBeTruthy()
    android.unmount()

    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    mockedReduceTransparency.mockReturnValue(true)
    const reduced = render(<GlassSurface />)
    expect(reduced.getByTestId('glass-surface-fallback')).toBeTruthy()
  })
})
