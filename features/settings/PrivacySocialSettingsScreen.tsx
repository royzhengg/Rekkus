import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BellIcon, LockIcon, MessageIcon, TagIcon, UserIcon, EyeIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { BackButton, ControlRow, Divider, SettingsGroup, SettingsSwitchRow } from '@/features/settings/SettingsControlDock'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'

export default function PrivacySocialSettingsScreen() {
  const router = useRouter()
  const { settings, updateSetting, updatePrivateAccountSetting } = useSettings()
  const { showToast } = useToast()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [confirmPublicVisible, setConfirmPublicVisible] = useState(false)

  async function makeAccountPublic() {
    setConfirmPublicVisible(false)
    try {
      const result = await updatePrivateAccountSetting(false)
      showToast(
        result.approvedCount > 0
          ? `${result.approvedCount} follow requests were approved.`
          : 'Your account is now public.',
        result.approvedCount > 0 ? { title: 'Your account is now public.' } : undefined
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Your privacy setting could not be updated.', { type: 'info' })
    }
  }

  function handlePrivateAccountChange(value: boolean) {
    if (!value && settings.private_account) {
      setConfirmPublicVisible(true)
      return
    }
    void updateSetting('private_account', value)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Privacy and social"
        left={<BackButton onPress={() => router.back()} />}
        right={null}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SettingsGroup title="Visibility">
          <SettingsSwitchRow
            label="Private account"
            sublabel="Only approved followers can see your posts"
            value={settings.private_account}
            onValueChange={handlePrivateAccountChange}
          />
          <Divider />
          <SettingsSwitchRow
            label="Activity visibility"
            sublabel="Show last active status in messages"
            value={settings.show_activity_status}
            onValueChange={value => { void updateSetting('show_activity_status', value) }}
          />
        </SettingsGroup>

        <SettingsGroup title="Interactions">
          <SettingsSwitchRow
            label="Allow comments"
            sublabel="People can comment on your posts"
            value={settings.allow_comments}
            onValueChange={value => { void updateSetting('allow_comments', value) }}
          />
          <Divider />
          <SettingsSwitchRow
            label="Allow tags and mentions"
            sublabel="People can tag or mention you"
            value={settings.allow_tags}
            onValueChange={value => { void updateSetting('allow_tags', value) }}
          />
        </SettingsGroup>

        <SettingsGroup title="Coming next">
          <ControlRow
            label="Who can follow me"
            summary={settings.private_account ? 'Approved' : 'Anyone'}
            sublabel="Private accounts approve followers"
            icon={<UserIcon size={18} color={colors.text} />}
          />
          <Divider />
          <ControlRow
            label="Who can message me"
            summary="Messages on"
            sublabel="Message controls are planned"
            icon={<MessageIcon size={18} color={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Muted accounts"
            summary="Chats"
            sublabel="Conversation mutes live in Messages"
            icon={<BellIcon size={17} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Blocked accounts"
            summary="Profiles"
            sublabel="Block or report from a profile"
            icon={<LockIcon size={18} color={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Tag review"
            summary={settings.allow_tags ? 'Anyone' : 'No one'}
            sublabel="Uses your tag and mention rule"
            icon={<TagIcon size={18} color={colors.text} />}
          />
          <Divider />
          <ControlRow
            label="Profile previews"
            summary={settings.private_account ? 'Limited' : 'Public'}
            sublabel="Uses your account visibility"
            icon={<EyeIcon size={18} />}
          />
        </SettingsGroup>

        <Text style={styles.footerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          These controls shape what other people can see and how they can interact with you.
        </Text>
      </ScrollView>
      {confirmPublicVisible ? (
        <RekkusActionSheet
          visible
          title="Make account public?"
          subtitle="All pending follow requests will be approved automatically and those users will begin following you. Anyone will be able to see your profile and posts."
          options={[
            { label: 'Make public', value: 'make_public', accentColor: colors.accent },
            { label: 'Keep private', value: 'keep_private' },
          ]}
          onSelect={value => { if (value === 'make_public') void makeAccountPublic(); else setConfirmPublicVisible(false) }}
          onDismiss={() => setConfirmPublicVisible(false)}
        />
      ) : null}
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
