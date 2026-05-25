import { useEffect, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type SkeletonProps = {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ width = '100%', height = spacing[4], radius: corner = radius.sm, style }: SkeletonProps) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(opacity)
  }, [reduceMotion, opacity])

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: corner }, style, animStyle]}
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={textStyles.wrap}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    base: {
      backgroundColor: c.surface2,
      overflow: 'hidden',
    },
  })
}

const textStyles = StyleSheet.create({
  wrap: {
    gap: spacing[2],
  },
})
