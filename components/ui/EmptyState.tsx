import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { spacing } from '@/constants/Spacing'
import { bodyBase, bodySmall, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type Props = {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}

export function EmptyState({ title, subtitle, icon }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.wrap}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
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
