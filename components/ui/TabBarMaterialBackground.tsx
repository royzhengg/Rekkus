import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View } from 'react-native'
import { useIsDarkMode, useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReduceTransparency } from '@/lib/hooks/useReduceTransparency'

type Props = {
  materialEnabled: boolean
}

export function TabBarMaterialBackground({ materialEnabled }: Props) {
  const colors = useThemeColors()
  const isDark = useIsDarkMode()
  const reduceTransparency = useReduceTransparency()
  const shouldRenderMaterial = Platform.OS === 'ios' && materialEnabled && !reduceTransparency

  if (shouldRenderMaterial) {
    return (
      <BlurView
        intensity={80}
        style={StyleSheet.absoluteFill}
        testID="tab-bar-material-background"
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      />
    )
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}
      testID="tab-bar-opaque-background"
    />
  )
}
