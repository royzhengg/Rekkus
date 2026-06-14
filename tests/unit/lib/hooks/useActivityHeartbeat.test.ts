import { act, renderHook } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { useActivityHeartbeat } from '@/lib/hooks/useActivityHeartbeat'
import { updateLastSeen } from '@/lib/services/users'

jest.mock('@/lib/services/users', () => ({
  updateLastSeen: jest.fn(),
}))

const mockUpdateLastSeen = jest.mocked(updateLastSeen)

describe('useActivityHeartbeat', () => {
  let appStateListener: ((state: string) => void) | null = null
  let remove: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-13T00:00:00.000Z'))
    jest.clearAllMocks()
    appStateListener = null
    remove = jest.fn()
    mockUpdateLastSeen.mockResolvedValue(undefined)
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, listener: (state: string) => void) => {
      if (event === 'change') appStateListener = listener
      return { remove }
    }) as never)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('records activity on mount, foreground, and interval with throttling', () => {
    renderHook(() => useActivityHeartbeat('user-1'))

    expect(mockUpdateLastSeen).toHaveBeenCalledTimes(1)
    expect(mockUpdateLastSeen).toHaveBeenCalledWith('user-1')

    act(() => appStateListener?.('active'))
    expect(mockUpdateLastSeen).toHaveBeenCalledTimes(1)

    act(() => {
      jest.advanceTimersByTime(45_000)
      appStateListener?.('active')
    })
    expect(mockUpdateLastSeen).toHaveBeenCalledTimes(2)

    act(() => {
      jest.advanceTimersByTime(75_000)
    })
    expect(mockUpdateLastSeen).toHaveBeenCalledTimes(3)
  })

  it('cleans up foreground and interval listeners', () => {
    const { unmount } = renderHook(() => useActivityHeartbeat('user-1'))
    unmount()

    expect(remove).toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(120_000)
    })
    expect(mockUpdateLastSeen).toHaveBeenCalledTimes(1)
  })

  it('does not record activity without a user', () => {
    renderHook(() => useActivityHeartbeat(null))
    expect(mockUpdateLastSeen).not.toHaveBeenCalled()
    expect(AppState.addEventListener).not.toHaveBeenCalled()
  })
})
