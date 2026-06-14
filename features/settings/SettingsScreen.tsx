import { useRouter } from 'expo-router'
import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronRight, ArrowLeft } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/features/settings/PrivacyDataScreen'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePressScale } from '@/lib/hooks/usePressScale'

function RowLink({
  label,
  sublabel,
  onPress,
}: {
  label: string
  sublabel?: string
  onPress: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const press = usePressScale()
  return (
    <Animated.View style={press.animatedStyle}>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
        </View>
        <ChevronRight />
      </TouchableOpacity>
    </Animated.View>
  )
}

function RowToggle({
  label,
  sublabel,
  value,
  onValueChange,
}: {
  label: string
  sublabel?: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surface2, true: colors.text }}
        thumbColor={colors.bg}
        ios_backgroundColor={colors.surface2}
        accessibilityLabel={label}
      />
    </View>
  )
}

type ThemeMode = 'light' | 'dark' | 'system'
const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Follow OS' },
]

function RowThemeSelector({
  value,
  onChange,
}: {
  value: ThemeMode
  onChange: (v: ThemeMode) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <Text style={styles.rowLabel}>Theme</Text>
      <View style={styles.themeSegment}>
        {THEME_OPTIONS.map((opt, i) => {
          const active = value === opt.value
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={[
                styles.themeOption,
                i === 0 && styles.themeOptionFirst,
                i === THEME_OPTIONS.length - 1 && styles.themeOptionLast,
                active && { backgroundColor: colors.text },
              ]}
            >
              <Text style={[styles.themeOptionText, active && { color: colors.bg }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function Divider() {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.divider} />
}

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { settings, updateSetting } = useSettings()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => { void (async () => {
          setSigningOut(true)
          await signOut()
          router.replace('/(tabs)/feed')
        })() },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <RowLink label="Edit profile" onPress={() => router.push('/settings/edit-profile')} />
          <Divider />
          <RowLink
            label="Change email"
            sublabel={user?.email ?? ''}
            onPress={() => router.push('/settings/change-email')}
          />
          <Divider />
          <RowLink
            label="Change password"
            onPress={() => router.push('/settings/change-password')}
          />
          <Divider />
          <RowLink
            label="Connected accounts"
            sublabel="Google"
            onPress={() => router.push('/settings/connected-accounts')}
          />
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <RowToggle
            label="Likes"
            value={settings.notif_likes}
            onValueChange={v => updateSetting('notif_likes', v)}
          />
          <Divider />
          <RowToggle
            label="Comments"
            value={settings.notif_comments}
            onValueChange={v => updateSetting('notif_comments', v)}
          />
          <Divider />
          <RowToggle
            label="New followers"
            value={settings.notif_followers}
            onValueChange={v => updateSetting('notif_followers', v)}
          />
          <Divider />
          <RowToggle
            label="Mentions & tags"
            value={settings.notif_mentions}
            onValueChange={v => updateSetting('notif_mentions', v)}
          />
          <Divider />
          <RowToggle
            label="Messages"
            sublabel="Private message replies"
            value={settings.notif_messages}
            onValueChange={v => updateSetting('notif_messages', v)}
          />
        </View>

        <SectionHeader title="Privacy" />
        <View style={styles.card}>
          <RowToggle
            label="Private account"
            sublabel="Only approved followers can see your posts"
            value={settings.private_account}
            onValueChange={v => updateSetting('private_account', v)}
          />
          <Divider />
          <RowToggle
            label="Allow comments"
            value={settings.allow_comments}
            onValueChange={v => updateSetting('allow_comments', v)}
          />
          <Divider />
          <RowToggle
            label="Allow tags"
            value={settings.allow_tags}
            onValueChange={v => updateSetting('allow_tags', v)}
          />
          <Divider />
          <RowToggle
            label="Show activity status"
            sublabel="Let people you message see when you were last active"
            value={settings.show_activity_status}
            onValueChange={v => updateSetting('show_activity_status', v)}
          />
        </View>

        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <RowThemeSelector
            value={settings.theme_mode}
            onChange={v => updateSetting('theme_mode', v)}
          />
          <Divider />
          <RowToggle
            label="Autoplay videos"
            sublabel="Muted when visible; Reduce Motion pauses autoplay"
            value={settings.autoplay_videos}
            onValueChange={v => updateSetting('autoplay_videos', v)}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <RowLink
            label="Privacy and data"
            sublabel="Policy, terms, export, deletion"

            onPress={() => router.push('/settings/privacy-data')}
          />
          <Divider />
          <RowLink label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
          <Divider />
          <RowLink label="Terms of service" onPress={() => Linking.openURL(TERMS_URL)} />
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowSublabel}>1.0.0</Text>
          </View>
        </View>

        <View style={styles.dangerZone}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.dangerBtnText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    scroll: { paddingTop: spacing[2] },
    sectionHeader: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      letterSpacing: letterSpacing.loose,
      textTransform: 'uppercase',
      marginTop: spacing[5],
      marginBottom: spacing.px6,
      marginHorizontal: spacing[4],
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      marginHorizontal: spacing[4],
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px13,
      minHeight: 50,
    },
    rowLabel: { fontSize: fontSize.md, color: c.text },
    rowSublabel: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing.px14 },
    themeSegment: {
      flexDirection: 'row',
      borderWidth: 0.5,
      borderColor: c.border2,
      borderRadius: radius.sm3,
      overflow: 'hidden',
    },
    themeOption: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px6,
      backgroundColor: 'transparent',
    },
    themeOptionFirst: { borderTopLeftRadius: radius.sm3, borderBottomLeftRadius: radius.sm3 },
    themeOptionLast: { borderTopRightRadius: radius.sm3, borderBottomRightRadius: radius.sm3 },
    themeOptionText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    dangerZone: { marginTop: spacing.px28, marginHorizontal: spacing[4], gap: spacing.px10 },
    dangerBtn: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border2,
    },
    dangerBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
  })
}
