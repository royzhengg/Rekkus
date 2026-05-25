import React, { useMemo } from 'react'
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { spacing } from '@/constants/Spacing'
import { bodyBase, bodySmall, fontWeight } from '@/constants/Typography'
import { SPRING_SMOOTH } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type Props = {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  loading?: boolean
}

export function EmptyState({ title, subtitle, icon, loading = false }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  const reduceMotion = useReducedMotion()
  return (
    <Animated.View
      {...(!reduceMotion ? { entering: FadeIn.springify().damping(SPRING_SMOOTH.damping ?? 20).stiffness(SPRING_SMOOTH.stiffness ?? 180) } : {})}
      style={styles.wrap}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={title}
          accessibilityRole="progressbar"
          color={c.text3}
          size="small"
          style={styles.icon}
        />
      ) : icon ? (
        <View style={styles.icon}>{icon}</View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[2] },
    icon: { marginBottom: spacing[1] },
    title: { ...bodyBase, fontWeight: fontWeight.medium, color: c.text, textAlign: 'center' },
    subtitle: { ...bodySmall, color: c.text3, textAlign: 'center' },
  })
}
