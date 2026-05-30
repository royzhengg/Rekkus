import { render } from '@testing-library/react-native'
import React from 'react'
import { Toast } from '@/components/ui/Toast'

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    successBg: '#EDFAF4',
    successText: '#0E7A54',
    infoBg: '#EBF2FF',
    infoText: '#1B4FA8',
  }),
}))

jest.mock('@/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}))

describe('Toast', () => {
  it('renders message text', () => {
    const screen = render(<Toast visible message="Post saved" />)
    expect(screen.getByText('Post saved')).toBeTruthy()
  })

  it('renders title when provided', () => {
    const screen = render(<Toast visible message="Post saved" title="Done" />)
    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.getByText('Post saved')).toBeTruthy()
  })

  it('omits title when not provided', () => {
    const screen = render(<Toast visible message="Post saved" />)
    expect(screen.queryByText('Done')).toBeNull()
  })

  it('announces via accessibilityLiveRegion polite', () => {
    const screen = render(<Toast visible message="Saved" />)
    expect(screen.UNSAFE_getByProps({ accessibilityLiveRegion: 'polite' })).toBeTruthy()
  })

  it('renders with type info without crashing', () => {
    const screen = render(<Toast visible message="Verification email sent" type="info" />)
    expect(screen.getByText('Verification email sent')).toBeTruthy()
  })
})
