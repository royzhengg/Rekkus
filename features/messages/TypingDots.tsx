import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'

export function TypingDots({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  const dot1 = useSharedValue(0)
  const dot2 = useSharedValue(0)
  const dot3 = useSharedValue(0)

  useEffect(() => {
    const bounce = (sv: typeof dot1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-5, { duration: 280 }),
            withTiming(0, { duration: 280 }),
            withTiming(0, { duration: 200 }),
          ),
          -1
        )
      )
    }
    bounce(dot1, 0)
    bounce(dot2, 130)
    bounce(dot3, 260)
  }, [dot1, dot2, dot3])

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }))
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }))
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }))

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.px5, paddingVertical: spacing.px6, paddingHorizontal: spacing[1] }}>
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s1]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s2]} />
      <Animated.View style={[{ width: 7, height: 7, borderRadius: radius.dotLg, backgroundColor: colors.text3 }, s3]} />
    </View>
  )
}
