import { useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, lineHeight } from '@/constants/Typography'

type Props = {
  message: string
  style?: StyleProp<ViewStyle>
}

export function ErrorMessage({ message, style }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={[styles.box, style]}>
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
    message: {
      fontSize: fontSize.base,
      color: c.errorText,
      lineHeight: lineHeight.small,
    },
  })
}
