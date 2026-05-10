import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import { ChevronRight, ArrowLeft } from '@/components/icons'
import { useAuth } from '@/lib/AuthContext'
import { useSettings } from '@/lib/SettingsContext'

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
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <ChevronRight />
    </TouchableOpacity>
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
      />
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
        onPress: async () => {
          setSigningOut(true)
          await signOut()
          router.replace('/(tabs)/feed')
        },
      },
    ])
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your posts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Contact support',
              'Please email support@rekkus.app to complete account deletion.'
            ),
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
          <RowLink label="Connected accounts" sublabel="Google" onPress={() => {}} />
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
        </View>

        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <RowToggle
            label="Dark mode"
            value={settings.dark_mode}
            onValueChange={v => updateSetting('dark_mode', v)}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <RowLink label="Privacy policy" onPress={() => {}} />
          <Divider />
          <RowLink label="Terms of service" onPress={() => {}} />
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowSublabel}>1.0.0</Text>
          </View>
        </View>

        <View style={styles.dangerZone}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={styles.dangerBtnText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerBtn, styles.deleteBtn]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={[styles.dangerBtnText, styles.deleteBtnText]}>Delete account</Text>
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '500', color: c.text },
    scroll: { paddingTop: 8 },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '600',
      color: c.text3,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 20,
      marginBottom: 6,
      marginHorizontal: 16,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 13,
      minHeight: 50,
    },
    rowLabel: { fontSize: 14, color: c.text },
    rowSublabel: { fontSize: 12, color: c.text3, marginTop: 2 },
    divider: { height: 0.5, backgroundColor: c.border, marginLeft: 14 },
    dangerZone: { marginTop: 28, marginHorizontal: 16, gap: 10 },
    dangerBtn: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border2,
    },
    dangerBtnText: { fontSize: 15, fontWeight: '500', color: c.text },
    deleteBtn: { borderColor: '#E24B4A' },
    deleteBtnText: { color: '#E24B4A' },
  })
}
