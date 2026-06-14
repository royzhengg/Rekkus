import { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { PinIcon } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type Props = {
  name: string
  onPress?: (() => void) | undefined
  loading?: boolean | undefined
  /** 'row' = plain pin+name inline (default). 'pill' = tappable accent pill. */
  variant?: 'row' | 'pill'
}

export function LocationTag({ name, onPress, loading = false, variant = 'row' }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const icon = loading
    ? <ActivityIndicator size="small" color={c.text3} style={styles.spinner} />
    : <PinIcon size={11} {...(variant === 'row' ? { color: c.text3 } : {})} />

  if (variant === 'pill') {
    return (
      <TouchableOpacity
        style={styles.pill}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`Open ${name}`}
      >
        {icon}
        <Text style={styles.pillText} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowText} numberOfLines={1}>{name}</Text>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    rowText: { flex: 1, fontSize: fontSize.bodySm, color: c.text3 },
    pill: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px5,
      alignSelf: 'flex-start',
      backgroundColor: `${c.accent}08`,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      borderWidth: 0.5,
      borderColor: `${c.accent}22`,
    },
    pillText: { fontSize: fontSize.bodySm, color: c.text2 },
    spinner: { width: 11, height: 11 },
  })
}
