import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { BackButton, Divider, SettingsGroup, SettingsSwitchRow } from '@/features/settings/SettingsControlDock'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useFeatureFlag } from '@/lib/featureFlags'

export default function NotificationsSettingsScreen() {
  const router = useRouter()
  const { settings, updateSetting } = useSettings()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const mentionNotificationsEnabled = useFeatureFlag('mentionNotifications')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        left={<BackButton onPress={() => router.back()} />}
        right={null}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SettingsGroup title="Social alerts">
          <SettingsSwitchRow
            label="Likes"
            sublabel="When people like your posts"
            value={settings.notif_likes}
            onValueChange={value => { void updateSetting('notif_likes', value) }}
          />
          <Divider />
          <SettingsSwitchRow
            label="Comments and replies"
            sublabel="New comments on your posts"
            value={settings.notif_comments}
            onValueChange={value => { void updateSetting('notif_comments', value) }}
          />
          <Divider />
          <SettingsSwitchRow
            label="New followers"
            sublabel="When someone follows you"
            value={settings.notif_followers}
            onValueChange={value => { void updateSetting('notif_followers', value) }}
          />
          {mentionNotificationsEnabled && (
            <>
              <Divider />
              <SettingsSwitchRow
                label="Mentions"
                sublabel="When someone mentions you in a post or comment"
                value={settings.notif_mentions}
                onValueChange={value => { void updateSetting('notif_mentions', value) }}
              />
            </>
          )}
          <Divider />
          <SettingsSwitchRow
            label="Messages"
            sublabel="Direct message notifications"
            value={settings.notif_messages}
            onValueChange={value => { void updateSetting('notif_messages', value) }}
          />
        </SettingsGroup>
        <Text style={styles.footerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          Device-level notification permissions are controlled by your phone settings.
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
