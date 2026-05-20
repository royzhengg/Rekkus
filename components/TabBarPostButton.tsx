import { TouchableOpacity, StyleSheet, View } from 'react-native'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { Svg, Line } from 'react-native-svg'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useMemo } from 'react'
import { SPRING_SNAPPY, PRESS_SCALE_ICON } from '@/lib/animations'
import { useCreateLauncher } from '@/lib/contexts/CreateLauncherContext'
import { radius } from '@/constants/Radius'

export function TabBarPostButton(_props: BottomTabBarButtonProps) {
  const { requireAuth } = useAuthGate()
  const { openCreateLauncher } = useCreateLauncher()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
          onPressIn={() => { scale.value = withSpring(PRESS_SCALE_ICON, SPRING_SNAPPY) }}
          onPressOut={() => { scale.value = withSpring(1, SPRING_SNAPPY) }}
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
