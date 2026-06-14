import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'
import { radius } from '@/constants/Radius'
import { useIsDarkMode, useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReduceTransparency } from '@/lib/hooks/useReduceTransparency'
import type React from 'react'

type GlassSurfaceVariant = 'panel' | 'chrome'

type Props = ViewProps & {
  children?: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
  intensity?: number
  materialEnabled?: boolean
  style?: StyleProp<ViewStyle>
  variant?: GlassSurfaceVariant
}

export function GlassSurface({
  children,
  contentStyle,
  intensity = 72,
  materialEnabled = true,
  style,
  testID,
  variant = 'panel',
  ...viewProps
}: Props) {
  const colors = useThemeColors()
  const isDark = useIsDarkMode()
  const reduceTransparency = useReduceTransparency()
  const shouldRenderMaterial = Platform.OS === 'ios' && materialEnabled && !reduceTransparency
  const styles = makeStyles(variant)
  const fallbackColor = variant === 'chrome' ? colors.bg : colors.surface

  if (shouldRenderMaterial) {
    return (
      <BlurView
        {...viewProps}
        intensity={intensity}
        style={[styles.surface, { borderColor: colors.border }, style]}
        testID={testID ?? 'glass-surface-material'}
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    )
  }

  return (
    <View
      {...viewProps}
      style={[styles.surface, { backgroundColor: fallbackColor, borderColor: colors.border }, style]}
      testID={testID ?? 'glass-surface-fallback'}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  )
}

function makeStyles(variant: GlassSurfaceVariant) {
  return StyleSheet.create({
    surface: {
      borderRadius: variant === 'chrome' ? radius.lg : radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    content: {
      flexGrow: 1,
    },
  })
}
