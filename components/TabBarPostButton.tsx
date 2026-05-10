import { TouchableOpacity, StyleSheet, View } from 'react-native'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { useThemeColors } from '@/lib/ThemeContext'
import { Svg, Line } from 'react-native-svg'
import { useAuthGate } from '@/lib/AuthGateContext'
import { useMemo } from 'react'

export function TabBarPostButton({ onPress }: BottomTabBarButtonProps) {
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  function handlePress(e: any) {
    requireAuth(() => onPress?.(e))
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.85}>
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
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    button: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
