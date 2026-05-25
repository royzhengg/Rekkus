import { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type Props = {
  title?: string
  message: string
  style?: StyleProp<ViewStyle>
}

export function ErrorMessage({ title, message, style }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View accessibilityRole="alert" style={[styles.box, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    box: {
      backgroundColor: c.errorBg,
      borderRadius: radius.sm3,
      padding: spacing.px10,
      marginBottom: spacing[4],
    },
    title: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: c.errorText,
      lineHeight: lineHeight.small,
      marginBottom: spacing[1],
    },
    message: {
      fontSize: fontSize.base,
      color: c.errorText,
      lineHeight: lineHeight.small,
    },
  })
}
