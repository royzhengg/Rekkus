import { useEffect } from 'react'
import { useVideoPlayer } from 'expo-video'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type Options = {
  autoplayActive: boolean
}

export function usePostVideoPlayback(uri: string, { autoplayActive }: Options) {
  const { settings } = useSettings()
  const reduceMotion = useReducedMotion()
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true
    instance.muted = true
  })

  useEffect(() => {
    if (settings.autoplay_videos && autoplayActive && !reduceMotion) {
      player.muted = true
      player.play()
      return
    }
    player.pause()
  }, [autoplayActive, player, reduceMotion, settings.autoplay_videos])

  return player
}
