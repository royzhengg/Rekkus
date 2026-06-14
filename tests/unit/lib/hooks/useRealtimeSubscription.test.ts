import { renderHook } from '@testing-library/react-native'
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription'

function makeChannel() {
  return { unsubscribe: jest.fn().mockResolvedValue('ok' as const) }
}

describe('useRealtimeSubscription', () => {
  afterEach(() => jest.clearAllMocks())

  it('calls subscribe when enabled', () => {
    const channel = makeChannel()
    const subscribe = jest.fn(() => channel)
    renderHook(() => useRealtimeSubscription(true, subscribe, []))
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('does not call subscribe when disabled', () => {
    const subscribe = jest.fn(() => makeChannel())
    renderHook(() => useRealtimeSubscription(false, subscribe, []))
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('calls provided cleanup callback on unmount', () => {
    const channel = makeChannel()
    const subscribe = jest.fn(() => channel)
    const cleanup = jest.fn()
    const { unmount } = renderHook(() =>
      useRealtimeSubscription(true, subscribe, [], cleanup)
    )
    unmount()
    expect(cleanup).toHaveBeenCalledWith(channel)
    expect(channel.unsubscribe).not.toHaveBeenCalled()
  })

  it('calls channel.unsubscribe as default cleanup when no callback provided', () => {
    const channel = makeChannel()
    const subscribe = jest.fn(() => channel)
    const { unmount } = renderHook(() =>
      useRealtimeSubscription(true, subscribe, [])
    )
    unmount()
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not call cleanup when disabled (nothing subscribed)', () => {
    const channel = makeChannel()
    const subscribe = jest.fn(() => channel)
    const cleanup = jest.fn()
    const { unmount } = renderHook(() =>
      useRealtimeSubscription(false, subscribe, [], cleanup)
    )
    unmount()
    expect(cleanup).not.toHaveBeenCalled()
    expect(channel.unsubscribe).not.toHaveBeenCalled()
  })

  it('re-subscribes when a dep changes', () => {
    const channel = makeChannel()
    const subscribe = jest.fn(() => channel)
    const cleanup = jest.fn()
    const { rerender } = renderHook(
      ({ dep }: { dep: string }) =>
        useRealtimeSubscription(true, subscribe, [dep], cleanup),
      { initialProps: { dep: 'a' } }
    )
    expect(subscribe).toHaveBeenCalledTimes(1)
    rerender({ dep: 'b' })
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
