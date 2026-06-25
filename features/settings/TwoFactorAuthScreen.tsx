import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useMFA } from '@/lib/hooks/useMFA'
import { recordAuthAuditEvent } from '@/lib/services/auth'
import { MFAReauthModal } from './MFAReauthModal'
import { BackButton } from './SettingsControlDock'

export default function TwoFactorAuthScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { verifiedFactors, mfaEnabled, remainingRecoveryCodes, disableMFA } = useMFA()
  const { showToast } = useToast()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [reauthVisible, setReauthVisible] = useState(false)
  const [disabling, setDisabling] = useState(false)

  const factor = verifiedFactors[0]
  const hasEmailIdentity = user?.identities?.some(i => i.provider === 'email') ?? false

  function formatDate(iso: string | undefined): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }

  function handleDisablePress() {
    analytics.twoFactorDisableStarted(user?.id ?? null)
    try { void recordAuthAuditEvent('mfa_disable_attempted') } catch { /* best-effort */ }
    setReauthVisible(true)
  }

  async function handleReauthSuccess() {
    setReauthVisible(false)
    if (!factor) return

    Alert.alert(
      'Turn off two-factor authentication?',
      'Removing your authenticator will sign you out of all devices. This will reduce your account security.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            analytics.twoFactorDisableCancelled(user?.id ?? null)
            try { void recordAuthAuditEvent('mfa_disable_cancelled') } catch { /* best-effort */ }
          },
        },
        {
          text: 'Turn Off',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDisabling(true)
              const error = await disableMFA(factor.id)
              setDisabling(false)
              if (error) {
                showToast(error)
                return
              }
              try { await recordAuthAuditEvent('mfa_unenrolled', { factor_id: factor.id }) } catch { /* best-effort */ }
              analytics.twoFactorRemoved(user?.id ?? null)
              // Mandatory global sign-out after disabling MFA
              await signOut()
            })()
          },
        },
      ]
    )
  }

  function handleReauthCancel() {
    setReauthVisible(false)
    analytics.twoFactorDisableCancelled(user?.id ?? null)
    try { void recordAuthAuditEvent('mfa_disable_cancelled') } catch { /* best-effort */ }
  }

  function handleRegenerateCodes() {
    Alert.alert(
      'Regenerate recovery codes?',
      'Regenerating will permanently invalidate all existing codes. Any codes shown on other devices become invalid immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => router.push('/settings/enable-2fa' as never),
        },
      ]
    )
  }

  if (!mfaEnabled) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="Two-Factor Authentication"
          left={<BackButton onPress={() => router.back()} />}
          right={<View style={styles.headerSpacer} />}
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.disabledCard}>
            <Text style={styles.disabledTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Two-factor authentication is off
            </Text>
            <Text style={styles.disabledBody} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              Add an extra layer of security to your account. You'll need to enter a code from your authenticator app every time you sign in.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!user?.email_confirmed_at) {
                  showToast('Verify your email address before setting up two-factor authentication.', { type: 'info' })
                  return
                }
                router.push('/settings/enable-2fa')
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Set up authenticator</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const codesWarning =
    remainingRecoveryCodes === 0
      ? 'No recovery codes remaining'
      : remainingRecoveryCodes === 1
      ? '1 recovery code remaining — regenerate soon'
      : null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Two-Factor Authentication"
        left={<BackButton onPress={() => router.back()} />}
        right={<View style={styles.headerSpacer} />}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
          <Text style={styles.factorName} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {factor?.friendly_name ?? 'Authenticator App'}
          </Text>
          <Text style={styles.factorDate} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            Added {formatDate((factor as { created_at?: string } | undefined)?.created_at)}
          </Text>
        </View>

        <View style={styles.recoverySection}>
          <Text style={styles.sectionLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Recovery codes
          </Text>
          <Text
            style={[
              styles.recoveryCount,
              remainingRecoveryCodes === 0 && styles.recoveryCountDanger,
              remainingRecoveryCodes === 1 && styles.recoveryCountWarning,
            ]}
            maxFontSizeMultiplier={maxFontSizeMultiplier.body}
          >
            {remainingRecoveryCodes === 0
              ? 'No codes remaining'
              : `${remainingRecoveryCodes} code${remainingRecoveryCodes === 1 ? '' : 's'} remaining`}
          </Text>
          {codesWarning ? (
            <Text style={styles.recoveryWarning} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              {codesWarning}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryBtn, remainingRecoveryCodes === 0 && styles.secondaryBtnUrgent]}
            onPress={handleRegenerateCodes}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text
              style={[styles.secondaryBtnText, remainingRecoveryCodes === 0 && styles.secondaryBtnTextUrgent]}
              maxFontSizeMultiplier={maxFontSizeMultiplier.body}
            >
              Regenerate recovery codes
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleDisablePress}
            disabled={disabling}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {disabling ? (
              <ActivityIndicator size="small" color={colors.liked} />
            ) : (
              <Text style={styles.dangerBtnText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Turn Off Two-Factor Authentication
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            This will reduce your account security.
          </Text>
        </View>
      </ScrollView>

      <MFAReauthModal
        visible={reauthVisible}
        hasEmailIdentity={hasEmailIdentity}
        factorId={factor?.id}
        onSuccess={handleReauthSuccess}
        onCancel={handleReauthCancel}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerSpacer: { width: spacing.px36 },
    scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing.px40 },
    disabledCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing[5],
      gap: spacing[4],
    },
    disabledTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    disabledBody: {
      fontSize: fontSize.md,
      color: c.text2,
      lineHeight: lineHeight.body,
    },
    activeCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing[5],
      gap: spacing[2],
    },
    activeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    activeBadge: {
      backgroundColor: c.successBg,
      borderRadius: radius.pill,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px6 / 2,
    },
    activeBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.success,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    factorName: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    factorDate: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    recoverySection: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing[5],
      gap: spacing[2],
    },
    sectionLabel: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.text2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    recoveryCount: {
      fontSize: fontSize.md,
      color: c.text,
    },
    recoveryCountWarning: { color: c.warning },
    recoveryCountDanger: { color: c.liked },
    recoveryWarning: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    secondaryBtn: {
      borderRadius: radius.md3,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      marginTop: spacing[1],
    },
    secondaryBtnUrgent: {
      borderColor: c.liked,
    },
    secondaryBtnText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    secondaryBtnTextUrgent: {
      color: c.liked,
    },
    dangerSection: {
      gap: spacing[2],
      alignItems: 'center',
      paddingTop: spacing[2],
    },
    dangerBtn: {
      paddingVertical: spacing[3],
    },
    dangerBtnText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.liked,
    },
    dangerNote: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    successBanner: {
      backgroundColor: c.successBg,
      borderRadius: radius.md3,
      padding: spacing[4],
    },
    successBannerText: {
      fontSize: fontSize.bodySm,
      color: c.success,
      lineHeight: lineHeight.body,
    },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px14,
      alignItems: 'center',
    },
    primaryBtnText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      color: c.bg,
    },
  })
}
