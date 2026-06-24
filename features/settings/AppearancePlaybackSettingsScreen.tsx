import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { BackButton, Divider, SettingsGroup, SettingsRadioRow, SettingsSwitchRow } from '@/features/settings/SettingsControlDock'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { label: string; value: ThemeMode; sublabel: string }[] = [
  { label: 'Follow system', value: 'system', sublabel: 'Match your phone appearance' },
  { label: 'Light', value: 'light', sublabel: 'Use the light Rekkus theme' },
  { label: 'Dark', value: 'dark', sublabel: 'Use the dark Rekkus theme' },
]

export default function AppearancePlaybackSettingsScreen() {
  const router = useRouter()
  const { settings, updateSetting } = useSettings()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Appearance"
        left={<BackButton onPress={() => router.back()} />}
        right={null}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SettingsGroup title="Theme">
          {THEME_OPTIONS.map((option, index) => (
            <React.Fragment key={option.value}>
              {index > 0 ? <Divider /> : null}
              <SettingsRadioRow
                label={option.label}
                sublabel={option.sublabel}
                selected={settings.theme_mode === option.value}
                onPress={() => { void updateSetting('theme_mode', option.value) }}
              />
            </React.Fragment>
          ))}
        </SettingsGroup>

        <SettingsGroup title="Playback">
          <SettingsSwitchRow
            label="Autoplay videos"
            sublabel="Muted videos play when visible. Reduce Motion still pauses autoplay."
            value={settings.autoplay_videos}
            onValueChange={value => { void updateSetting('autoplay_videos', value) }}
          />
        </SettingsGroup>

        <Text style={styles.footerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          Video playback follows your Reduce Motion setting even when autoplay is on.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: {
      paddingTop: spacing[4],
      paddingBottom: spacing.px40,
    },
    footerNote: {
      marginHorizontal: spacing[4],
      marginTop: spacing[4],
      color: c.text3,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.body,
    },
  })
}
