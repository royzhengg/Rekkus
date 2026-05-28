import { act, renderHook } from '@testing-library/react-native'
import { AccessibilityInfo, Platform } from 'react-native'
import { useReduceTransparency } from '@/lib/hooks/useReduceTransparency'

describe('useReduceTransparency', () => {
  const originalOs = Platform.OS
  let onChange: ((enabled: boolean) => void) | undefined

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    onChange = undefined
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false)
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'reduceTransparencyChanged') {
        onChange = listener
      }
      return { remove: jest.fn() }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs })
  })

  it('keeps iOS opaque until the system preference has resolved', async () => {
    const { result } = renderHook(() => useReduceTransparency())
    expect(result.current).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toBe(false)
  })

  it('updates when Reduce Transparency changes', async () => {
    const { result } = renderHook(() => useReduceTransparency())
    await act(async () => {
      await Promise.resolve()
    })

    act(() => onChange?.(true))
    expect(result.current).toBe(true)
  })
})
