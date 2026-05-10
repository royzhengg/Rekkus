import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

type Props = {
  title?: string
  left?: React.ReactNode
  right?: React.ReactNode
  border?: boolean
}

export function ScreenHeader({ title, left, right, border = true }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c, border), [c, border])
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{left}</View>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={styles.sideRight}>{right}</View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>, border: boolean) {
  return StyleSheet.create({
    bar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderBottomWidth: border ? 0.5 : 0,
      borderBottomColor: c.border,
    },
    side: { width: 60, alignItems: 'flex-start' },
    sideRight: { width: 60, alignItems: 'flex-end' },
    title: { flex: 1, fontSize: 15, fontWeight: '500', color: c.text, textAlign: 'center' },
    flex: { flex: 1 },
  })
}
