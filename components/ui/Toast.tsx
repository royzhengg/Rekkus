import { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { DUR_MID } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type Props = {
  visible: boolean
  message: string
  title?: string
  type?: 'success' | 'info'
  style?: StyleProp<ViewStyle>
}

export function Toast({ visible, message, title, type = 'success', style }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : DUR_MID })
  }, [visible, reduceMotion, opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const boxStyle = type === 'info' ? styles.infoBox : styles.successBox
  const titleStyle = type === 'info' ? styles.infoTitle : styles.successTitle
  const messageStyle = type === 'info' ? styles.infoMessage : styles.successMessage

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: insets.bottom + spacing[4] },
        animatedStyle,
        style,
      ]}
    >
      <View style={[styles.box, boxStyle]}>
        {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
        <Text style={[styles.message, messageStyle]}>{message}</Text>
      </View>
    </Animated.View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      left: spacing[4],
      right: spacing[4],
      zIndex: 9999,
    },
    box: {
      borderRadius: radius.sm3,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px10,
    },
    successBox: { backgroundColor: c.successBg },
    infoBox: { backgroundColor: c.infoBg },
    title: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.small,
      marginBottom: spacing[1],
    },
    successTitle: { color: c.successText },
    infoTitle: { color: c.infoText },
    message: {
      fontSize: fontSize.base,
      lineHeight: lineHeight.small,
    },
    successMessage: { color: c.successText },
    infoMessage: { color: c.infoText },
  })
}
