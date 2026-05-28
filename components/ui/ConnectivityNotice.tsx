import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export function ConnectivityNotice() {
  const { state, pendingCount, syncState } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const message = state === 'offline'
    ? pendingCount > 0
      ? `Offline. ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync.`
      : 'Offline. Browse saved content; online actions will retry when connected.'
    : state === 'degraded'
      ? 'Connection is unstable. Pending changes will retry when you reconnect.'
    : syncState === 'syncing'
      ? `Syncing ${pendingCount} pending change${pendingCount === 1 ? '' : 's'}...`
      : syncState === 'synced'
        ? 'Your pending changes are synced.'
        : syncState === 'failed'
          ? 'Some pending changes could not sync. They will retry when you reconnect.'
          : null

  if (!message) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.notice, state === 'offline' || state === 'degraded' || syncState === 'failed' ? styles.warning : styles.success]}
    >
      <Text style={[styles.text, state === 'offline' || state === 'degraded' || syncState === 'failed' ? styles.warningText : styles.successText]}>
        {message}
      </Text>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    notice: {
      marginHorizontal: spacing[4],
      marginTop: spacing[2],
      borderRadius: radius.sm3,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px10,
    },
    warning: { backgroundColor: c.ratingBg },
    success: { backgroundColor: c.chipCategorySageBg },
    text: { fontSize: fontSize.base, fontWeight: fontWeight.medium, lineHeight: lineHeight.small },
    warningText: { color: c.ratingText },
    successText: { color: c.chipCategorySageText },
  })
}
