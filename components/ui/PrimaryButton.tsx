import React, { useMemo } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { SPRING_SNAPPY, PRESS_SCALE_PRIMARY } from '@/lib/animations'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type Props = {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, loading, disabled }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={onPress}
        onPressIn={() => { if (!disabled && !loading) scale.value = withSpring(PRESS_SCALE_PRIMARY, SPRING_SNAPPY) }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_SNAPPY) }}
        disabled={disabled || loading}
        activeOpacity={1}
      >
        {loading ? (
          <ActivityIndicator color={c.bg} size="small" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    btn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.45 },
    label: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: c.bg },
  })
}
