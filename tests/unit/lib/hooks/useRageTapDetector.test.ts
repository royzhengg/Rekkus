import { renderHook, act } from '@testing-library/react-native'
import { useRageTapDetector } from '@/lib/hooks/useRageTapDetector'

describe('useRageTapDetector', () => {
  let dateSpy: jest.SpyInstance
  let now: number

  beforeEach(() => {
    now = 1_000_000
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    dateSpy.mockRestore()
  })

  it('calls onPress on every tap', () => {
    const onPress = jest.fn()
    const onRageTap = jest.fn()
    const { result } = renderHook(() => useRageTapDetector(onPress, onRageTap))

    act(() => { result.current() })
    act(() => { result.current() })

    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('fires onRageTap after 3 rapid taps within 1s', () => {
    const onPress = jest.fn()
    const onRageTap = jest.fn()
    const { result } = renderHook(() => useRageTapDetector(onPress, onRageTap))

    act(() => { result.current() })
    now += 200
    act(() => { result.current() })
    now += 200
    act(() => { result.current() })

    expect(onRageTap).toHaveBeenCalledTimes(1)
    expect(onRageTap).toHaveBeenCalledWith(3)
  })

  it('fires onRageTap only once for 4 rapid taps — 4th tap starts a fresh window after reset', () => {
    const onPress = jest.fn()
    const onRageTap = jest.fn()
    const { result } = renderHook(() => useRageTapDetector(onPress, onRageTap))

    act(() => { result.current() })
    now += 100
    act(() => { result.current() })
    now += 100
    act(() => { result.current() }) // threshold reached at tap 3 — fires onRageTap(3) and resets
    now += 100
    act(() => { result.current() }) // 4th tap: fresh window after reset — no second fire

    expect(onRageTap).toHaveBeenCalledTimes(1)
    expect(onRageTap).toHaveBeenCalledWith(3)
  })

  it('resets after a rage burst so the next tap starts a fresh window', () => {
    const onPress = jest.fn()
    const onRageTap = jest.fn()
    const { result } = renderHook(() => useRageTapDetector(onPress, onRageTap))

    // Trigger rage burst
    act(() => { result.current() })
    now += 200
    act(() => { result.current() })
    now += 200
    act(() => { result.current() }) // burst fires, timestamps reset

    onRageTap.mockClear()

    // Single tap after reset — should not re-trigger
    now += 200
    act(() => { result.current() })

    expect(onRageTap).not.toHaveBeenCalled()
  })

  it('does not fire onRageTap for taps spaced more than 1s apart', () => {
    const onPress = jest.fn()
    const onRageTap = jest.fn()
    const { result } = renderHook(() => useRageTapDetector(onPress, onRageTap))

    act(() => { result.current() })
    now += 600
    act(() => { result.current() })
    now += 600 // first tap is now 1200ms ago — expires from window
    act(() => { result.current() })

    expect(onRageTap).not.toHaveBeenCalled()
  })
})
