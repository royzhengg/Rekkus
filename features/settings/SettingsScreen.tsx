import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  BellIcon,
  EyeIcon,
  ListIcon,
  LockIcon,
  MapPinIcon,
  SaveIcon,
  UserIcon,
} from '@/components/icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { spacing } from '@/constants/Spacing'
import { fontSize, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/features/settings/PrivacyDataScreen'
import { BackButton, ControlRow, Divider, ProfileCard, SettingsGroup } from '@/features/settings/SettingsControlDock'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { fetchProfile, type ProfileInfo } from '@/lib/services/users'
import { formatLinkedAuthProviders } from '@/lib/utils/authProviders'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

function notificationSummary(settings: ReturnType<typeof useSettings>['settings']) {
  const values = [
    settings.notif_likes,
    settings.notif_comments,
    settings.notif_followers,
    settings.notif_mentions,
    settings.notif_messages,
  ]
  if (values.every(Boolean)) return 'On'
  if (values.every(value => !value)) return 'Quiet'
  if (settings.notif_mentions && settings.notif_messages && !settings.notif_likes && !settings.notif_comments && !settings.notif_followers) {
    return 'Only important'
  }
  return 'Custom'
}

function interactionSummary(settings: ReturnType<typeof useSettings>['settings']) {
  const comments = settings.allow_comments ? 'Comments' : 'No comments'
  const tags = settings.allow_tags ? 'tags' : 'no tags'
  return `${comments} / ${tags}`
}

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { settings } = useSettings()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    void fetchProfile(user.id)
      .then(setProfile)
      .catch(() => {
        analytics.actionError(user.id, 'load_settings_profile', 'provider_error')
      })
  }, [user])

  const visibilitySummary = settings.private_account ? 'Private account' : 'Public account'
  const email = user?.email ?? 'Signed in'

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    router.replace('/(tabs)/feed')
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You can return by signing in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void handleSignOut() } },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Settings"
        left={<BackButton onPress={() => router.back()} />}
        right={<View style={styles.headerSpacer} />}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ProfileCard
          profile={profile}
          email={email}
          visibility={visibilitySummary}
          onEditProfile={() => router.push('/settings/edit-profile')}
        />

        <SettingsGroup title="Account center">
          <ControlRow
            label="Notifications"
            summary={notificationSummary(settings)}
            sublabel="Social and message alerts"
            icon={<BellIcon size={17} />}
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider />
          <ControlRow
            label="Privacy and social"
            summary={settings.private_account ? 'Private' : 'Public'}
            sublabel={interactionSummary(settings)}
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/privacy-social')}
          />
          <Divider />
          <ControlRow
            label="Appearance and playback"
            summary={THEME_LABELS[settings.theme_mode]}
            sublabel={settings.autoplay_videos ? 'Autoplay videos' : 'Manual video playback'}
            icon={<EyeIcon size={18} />}
            onPress={() => router.push('/settings/appearance-playback')}
          />
        </SettingsGroup>

        <SettingsGroup title="Discovery and taste">
          <ControlRow
            label="Taste profile"
            summary="Learning"
            sublabel="Built from saves, reviews, and dish signals"
            icon={<UserIcon size={18} color={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Home area"
            summary="Not set"
            sublabel="Future anchor for local discovery"
            icon={<MapPinIcon size={18} color={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Hidden dishes and places"
            summary="None"
            sublabel="Mute recommendations you do not want"
            icon={<EyeIcon size={18} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Recommendation controls"
            summary="Default"
            sublabel="Reset or tune future taste signals"
            icon={<SaveIcon size={18} activeColor={colors.text} inactiveColor={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Saved content defaults"
            summary="Private"
            sublabel="Default collection and save visibility"
            icon={<ListIcon size={18} color={colors.text} />}
            planned
          />
        </SettingsGroup>

        <SettingsGroup title="Account and security">
          <ControlRow
            label="Email"
            summary={email}
            sublabel="Change your sign-in email"
            icon={<UserIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/change-email')}
          />
          <Divider />
          <ControlRow
            label="Password"
            summary="Protected"
            sublabel="Update your password"
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/change-password')}
          />
          <Divider />
          <ControlRow
            label="Connected accounts"
            summary={formatLinkedAuthProviders(user)}
            sublabel="Manage linked sign-in methods"
            icon={<UserIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/connected-accounts')}
          />
          <Divider />
          <ControlRow
            label="Login sessions"
            summary="This device"
            sublabel="Device management is planned"
            icon={<LockIcon size={18} color={colors.text} />}
            planned
          />
          <Divider />
          <ControlRow
            label="Sign out"
            summary={signingOut ? 'Signing out...' : 'End session'}
            sublabel="Leave this device"
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={confirmSignOut}
          />
        </SettingsGroup>

        <SettingsGroup title="Data, privacy and app">
          <ControlRow
            label="Privacy and data"
            summary="Requests"
            sublabel="Policy, terms, export, deletion"
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/privacy-data')}
          />
          <Divider />
          <ControlRow
            label="Privacy policy"
            summary="Open"
            sublabel="How Rekkus uses data"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <Divider />
          <ControlRow
            label="Terms of service"
            summary="Open"
            sublabel="Rules for using Rekkus"
            onPress={() => Linking.openURL(TERMS_URL)}
          />
          <Divider />
          <ControlRow
            label="Version"
            summary="1.0.0"
            sublabel="Installed app build"
          />
        </SettingsGroup>

        <Text style={styles.footerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
          More taste and discovery controls will unlock as Rekkus learns from saves, reviews, and local recommendations.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerSpacer: { width: spacing.px36 },
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
