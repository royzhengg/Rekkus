import { useCallback } from 'react'
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { PRESS_SCALE_ICON, SPRING_SNAPPY } from '@/lib/animations'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

export function usePressScale(scaleTo = PRESS_SCALE_ICON) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const onPressIn = useCallback(() => {
    if (reduceMotion) return
    scale.value = withSpring(scaleTo, SPRING_SNAPPY)
  }, [reduceMotion, scale, scaleTo])

  const onPressOut = useCallback(() => {
    if (reduceMotion) return
    scale.value = withSpring(1, SPRING_SNAPPY)
  }, [reduceMotion, scale])

  return { animatedStyle, onPressIn, onPressOut }
}
