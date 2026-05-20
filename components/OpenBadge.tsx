import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export const OpenBadge = React.memo(function OpenBadge({ openNow }: { openNow: boolean }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={[styles.badge, openNow ? styles.open : styles.closed]}>
      <Text style={[styles.text, openNow ? styles.textOpen : styles.textClosed]}>
        {openNow ? 'Open' : 'Closed'}
      </Text>
    </View>
  )
})

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    badge: { borderRadius: radius.xs, paddingHorizontal: spacing.px6, paddingVertical: spacing.px2 },
    open: { backgroundColor: `${c.success}18` },
    closed: { backgroundColor: `${c.actionDelete}18` },
    text: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
    textOpen: { color: c.success },
    textClosed: { color: c.actionDelete },
  })
}
