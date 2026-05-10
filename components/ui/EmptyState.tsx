import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

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
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 50, gap: 8 },
    icon: { marginBottom: 4 },
    title: { fontSize: 14, fontWeight: '500', color: c.text, textAlign: 'center' },
    subtitle: { fontSize: 13, color: c.text3, textAlign: 'center', lineHeight: 20 },
  })
}
