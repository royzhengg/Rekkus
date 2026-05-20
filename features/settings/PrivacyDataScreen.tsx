import React, { useMemo } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, ChevronRight } from '@/components/icons'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

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
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
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

  const emailLink = (subject: string) =>
    Linking.openURL(`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}`)

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
            onPress={() => emailLink('Data export request')}
          />
          <Divider />
          <Row
            label="Request account deletion"
            sublabel="Ask Rekkus to delete your account and user-owned data."
            onPress={() => emailLink('Account deletion request')}
          />
          <Divider />
          <Row
            label="Correct data"
            sublabel="Report inaccurate profile or restaurant data."
            onPress={() => emailLink('Data correction request')}
          />
        </View>

        <Text style={styles.sectionHeader}>How Rekkus Uses Data</Text>
        <View style={styles.infoCard}>
          <Text style={styles.body}>
            Rekkus uses your posts, saves, ratings, searches, and restaurant corrections to improve
            dish-first discovery. Restaurant provider data is used as fallback or enrichment and is
            kept source-attributed.
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
      letterSpacing: 0.6,
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
