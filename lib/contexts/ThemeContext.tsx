import { useColorScheme, type ColorSchemeName } from 'react-native'
import { lightColors, darkColors } from '@/constants/Colors'
import { useSettings } from './SettingsContext'

export type ColorTokens = typeof lightColors

function resolveIsDark(themeMode: 'light' | 'dark' | 'system', osScheme: ColorSchemeName): boolean {
  if (themeMode === 'dark') return true
  if (themeMode === 'light') return false
  return osScheme === 'dark'
}

export function useIsDarkMode(): boolean {
  const { settings } = useSettings()
  const osScheme = useColorScheme()
  return resolveIsDark(settings.theme_mode, osScheme)
}

export function useThemeColors(): ColorTokens {
  const isDark = useIsDarkMode()
  return isDark ? darkColors : lightColors
}
