import { useMemo } from 'react'
import { TouchableOpacity, StyleSheet, View } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Svg, Line } from 'react-native-svg'
import { radius } from '@/constants/Radius'
import { SPRING_SNAPPY, PRESS_SCALE_ICON } from '@/lib/animations'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useCreateLauncher } from '@/lib/contexts/CreateLauncherContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'

export function TabBarPostButton(_props: BottomTabBarButtonProps) {
  const { requireAuth } = useAuthGate()
  const { openCreateLauncher } = useCreateLauncher()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  function handlePress() {
    requireAuth(openCreateLauncher)
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          onPressIn={() => {
            if (reduceMotion) return
            scale.value = withSpring(PRESS_SCALE_ICON, SPRING_SNAPPY)
          }}
          onPressOut={() => {
            if (reduceMotion) return
            scale.value = withSpring(1, SPRING_SNAPPY)
          }}
          accessibilityRole="button"
          accessibilityLabel="Create post"
          activeOpacity={1}
        >
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            stroke={colors.bg}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          >
            <Line x1={12} y1={5} x2={12} y2={19} />
            <Line x1={5} y1={12} x2={19} y2={12} />
          </Svg>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    button: {
      width: 42,
      height: 42,
      borderRadius: radius.md4,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
