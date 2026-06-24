import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, ChevronRight } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { submitPrivacyRequest } from '@/lib/services/privacyRequests'

export const PRIVACY_POLICY_URL = 'https://rekkus.com/privacy'
export const TERMS_URL = 'https://rekkus.com/terms'
const PRIVACY_EMAIL = 'privacy@rekkus.com'

function Row({
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
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <ChevronRight />
    </TouchableOpacity>
  )
}

function Divider() {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.divider} />
}

export default function PrivacyDataScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { user, deleteAccount } = useAuth()
  const { showToast } = useToast()
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false)

  const emailLink = (subject: string) =>
    Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}`)

  async function handleExportRequest() {
    if (!user) return
    await submitPrivacyRequest(user.id, 'export')
    showToast('Privacy request submitted', { title: 'Request received' })
  }

  async function handleDeleteConfirm() {
    setDeleteSheetVisible(false)
    await deleteAccount()
    router.replace('/(tabs)/feed')
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
        <Text style={styles.title}>Privacy and data</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionHeader}>Documents</Text>
        <View style={styles.card}>
          <Row label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
          <Divider />
          <Row label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL)} />
        </View>

        <Text style={styles.sectionHeader}>Requests</Text>
        <View style={styles.card}>
          <Row
            label="Request data export"
            sublabel="Ask for a copy of your account data."
            onPress={() => void handleExportRequest()}
          />
          <Divider />
          <Row
            label="Delete account now"
            sublabel="Permanently delete your account and all data."
            onPress={() => setDeleteSheetVisible(true)}
          />
          <Divider />
          <Row
            label="Correct data"
            sublabel="Report inaccurate profile or place data."
            onPress={() => emailLink('Data correction request')}
          />
        </View>

        <Text style={styles.sectionHeader}>How Rekkus Uses Data</Text>
        <View style={styles.infoCard}>
          <Text style={styles.body}>
            Rekkus uses your posts, saves, ratings, searches, and place corrections to improve
            food-first discovery. Place provider data is used as fallback or enrichment and is kept
            source-attributed.
          </Text>
          <Text style={styles.body}>
            Location, photos, notifications, and provider data should only be used for the feature
            you choose, with retention, deletion, and export handled through the privacy process.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>Contact</Text>
        <View style={styles.card}>
          <Row
            label="Privacy contact"
            sublabel={PRIVACY_EMAIL}
            onPress={() => emailLink('Privacy question')}
          />
        </View>
      </ScrollView>
      <RekkusActionSheet
        visible={deleteSheetVisible}
        title="Delete account"
        subtitle="This will permanently delete your account and all your data. This cannot be undone."
        options={[{ label: 'Delete account', value: 'confirm', destructive: true }]}
        onSelect={() => void handleDeleteConfirm()}
        onDismiss={() => setDeleteSheetVisible(false)}
      />
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
    scroll: { paddingTop: spacing[2], paddingBottom: spacing.px40 },
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
    infoCard: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      marginHorizontal: spacing[4],
      padding: spacing.px14,
      gap: spacing.px10,
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
    body: { fontSize: fontSize.base, lineHeight: lineHeight.body, color: c.text2 },
    divider: { height: 0.5, backgroundColor: c.border, marginLeft: spacing.px14 },
  })
}
