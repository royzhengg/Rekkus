import { renderHook } from '@testing-library/react-native'
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: jest.fn(),
}))

const mockedBase = jest.mocked(useReanimatedReducedMotion)

describe('useReducedMotion', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns false when reduced motion is off', () => {
    mockedBase.mockReturnValue(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when reduced motion is on', () => {
    mockedBase.mockReturnValue(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })
})
