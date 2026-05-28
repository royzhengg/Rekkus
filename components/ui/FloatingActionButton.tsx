import { useMemo, type ReactNode } from 'react'
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type Props = {
  children: ReactNode
  accessibilityLabel: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export function FloatingActionButton({
  children,
  accessibilityLabel,
  onPress,
  style,
}: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, style]}
    >
      {children}
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    button: {
      width: spacing.px56,
      height: spacing.px56,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
      borderWidth: spacing.px1,
      borderColor: c.bg,
    },
  })
}
