import { act, renderHook } from '@testing-library/react-native'
import { useVideoPlayer } from 'expo-video'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { usePostVideoPlayback } from '@/lib/hooks/usePostVideoPlayback'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
}))
jest.mock('@/lib/contexts/SettingsContext', () => ({
  useSettings: jest.fn(),
}))
jest.mock('@/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: jest.fn(),
}))

const player = { play: jest.fn(), pause: jest.fn(), muted: false, loop: false }
const mockedPlayer = jest.mocked(useVideoPlayer)
const mockedSettings = jest.mocked(useSettings)
const mockedReducedMotion = jest.mocked(useReducedMotion)

describe('usePostVideoPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    player.muted = false
    player.loop = false
    mockedPlayer.mockImplementation((_uri, setup) => {
      setup?.(player as never)
      return player as never
    })
    mockedSettings.mockReturnValue({ settings: { autoplay_videos: true } } as never)
    mockedReducedMotion.mockReturnValue(false)
  })

  it('autoplays only while active and autoplay is permitted', () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => usePostVideoPlayback('video.mp4', { autoplayActive: active }),
      { initialProps: { active: false } },
    )
    expect(player.pause).toHaveBeenCalled()
    act(() => rerender({ active: true }))
    expect(player.play).toHaveBeenCalled()
    expect(player.loop).toBe(true)
    expect(player.muted).toBe(true)
  })

  it('pauses autoplay when reduced motion is enabled', () => {
    mockedReducedMotion.mockReturnValue(true)
    renderHook(() => usePostVideoPlayback('video.mp4', { autoplayActive: true }))
    expect(player.play).not.toHaveBeenCalled()
    expect(player.pause).toHaveBeenCalled()
  })

  it('pauses autoplay when the saved preference is disabled', () => {
    mockedSettings.mockReturnValue({ settings: { autoplay_videos: false } } as never)
    renderHook(() => usePostVideoPlayback('video.mp4', { autoplayActive: true }))
    expect(player.play).not.toHaveBeenCalled()
    expect(player.pause).toHaveBeenCalled()
  })
})
