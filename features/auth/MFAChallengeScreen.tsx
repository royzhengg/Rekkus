// MFA challenge screen — post-login gate.
// INVARIANT: this screen exits only on successful verification or sign-out.
// A session alone is not sufficient to exit — AAL must be satisfied or
// mfaRequired must be cleared (recovery code path). Never add "if session → navigate home" here.

import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useMFA } from '@/lib/hooks/useMFA'
import { recordAuthAuditEvent } from '@/lib/services/auth'

const ATTEMPT_COUNT_KEY = 'mfa:attempt_count'
const LOCKOUT_UNTIL_KEY = 'mfa:lockout_until'
const LOCKOUT_THRESHOLD = 5   // attempts before lockout
const LOCKOUT_SECONDS = 30
const SIGNOUT_THRESHOLD = 10  // attempts before forced sign-out

async function getAttemptCount(): Promise<number> {
  try {
    const v = await SecureStore.getItemAsync(ATTEMPT_COUNT_KEY)
    return v ? parseInt(v, 10) : 0
  } catch { return 0 }
}

async function incrementAttemptCount(): Promise<number> {
  const count = await getAttemptCount() + 1
  await SecureStore.setItemAsync(ATTEMPT_COUNT_KEY, String(count))
  return count
}

async function clearAttemptCount(): Promise<void> {
  await SecureStore.deleteItemAsync(ATTEMPT_COUNT_KEY)
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY)
}

async function getLockoutUntil(): Promise<number> {
  try {
    const v = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY)
    return v ? parseInt(v, 10) : 0
  } catch { return 0 }
}

async function setLockoutUntil(untilMs: number): Promise<void> {
  await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, String(untilMs))
}

export default function MFAChallengeScreen() {
  const router = useRouter()
  const { user, setMfaRequired, signOut } = useAuth()
  const { verifiedFactors, issueChallenge, verifyChallenge, verifyRecoveryCode } = useMFA()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [mode, setMode] = useState<'totp' | 'recovery'>('totp')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [challengeRetryCount, setChallengeRetryCount] = useState(0)
  const [otpValue, setOtpValue] = useState('')
  const [recoveryValue, setRecoveryValue] = useState('')
  const [preparing, setPreparing] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockoutUntil, setLockoutUntilState] = useState(0)
  const [_attemptCount, setAttemptCount] = useState(0)
  const inputRef = useRef<TextInput>(null)
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
    }
  }, [])

  // Issue the initial challenge on mount
  const doIssueChallenge = useCallback(async (retry = false) => {
    const factorId = verifiedFactors[0]?.id
    if (!factorId) return
    const result = await issueChallenge(factorId)
    if (!mountedRef.current) return
    if ('error' in result) {
      setError('Could not start verification. Please sign out and try again.')
      setPreparing(false)
      return
    }
    setChallengeId(result.challengeId)
    if (!retry) {
      try { await recordAuthAuditEvent('mfa_challenge_started') } catch { /* best-effort */ }
      analytics.twoFactorChallengePresented(user?.id ?? null)
    }
    setPreparing(false)
  }, [verifiedFactors, issueChallenge, user?.id])

  useEffect(() => {
    void (async () => {
      // Load lockout state from persistent store on mount.
      // Challenge issuance is handled separately when verifiedFactors loads.
      const [count, until] = await Promise.all([getAttemptCount(), getLockoutUntil()])
      if (mountedRef.current) {
        setAttemptCount(count)
        setLockoutUntilState(until)
      }
    })()
  }, [])

  // Wait for factors to load before issuing challenge
  useEffect(() => {
    if (verifiedFactors.length > 0 && preparing) {
      void doIssueChallenge()
    }
  }, [verifiedFactors, preparing, doIssueChallenge])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutUntil <= Date.now()) return
    const tick = () => {
      if (!mountedRef.current) return
      const remaining = lockoutUntil - Date.now()
      if (remaining <= 0) {
        setLockoutUntilState(0)
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current)
      }
    }
    lockoutTimerRef.current = setInterval(tick, 500)
    return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current) }
  }, [lockoutUntil])

  const isLockedOut = lockoutUntil > Date.now()
  const lockoutSecondsLeft = isLockedOut ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0

  async function handleAttemptFailed(isRecovery: boolean) {
    const count = await incrementAttemptCount()
    if (!mountedRef.current) return
    setAttemptCount(count)

    if (count >= SIGNOUT_THRESHOLD) {
      await clearAttemptCount()
      await signOut()
      return
    }
    if (count >= LOCKOUT_THRESHOLD) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000
      await setLockoutUntil(until)
      setLockoutUntilState(until)
    }

    const currentAttempt = count
    if (isRecovery) {
      setError('Invalid recovery code. Check the code and try again.')
      try { await recordAuthAuditEvent('mfa_recovery_code_failed', { attempt_number: currentAttempt }) } catch { /* best-effort */ }
      analytics.twoFactorRecoveryCodeFailed(user?.id ?? null, currentAttempt)
    } else {
      setError('Incorrect code. Try again.')
      try { await recordAuthAuditEvent('mfa_challenge_failed', { attempt_number: currentAttempt }) } catch { /* best-effort */ }
      analytics.twoFactorChallengeFailed(user?.id ?? null, currentAttempt)
    }
  }

  async function handleVerifyTOTP(code: string) {
    if (!challengeId || verifying || isLockedOut) return
    const factorId = verifiedFactors[0]?.id
    if (!factorId) return

    setVerifying(true)
    setError(null)

    const errorMsg = await verifyChallenge(factorId, challengeId, code)

    if (!mountedRef.current) return
    setVerifying(false)

    if (!errorMsg) {
      await clearAttemptCount()
      try { await recordAuthAuditEvent('mfa_verified') } catch { /* best-effort */ }
      analytics.twoFactorChallengeSucceeded(user?.id ?? null)
      setMfaRequired(false)
      router.replace('/(tabs)/feed')
      return
    }

    // Expired challenge — retry once
    if (errorMsg.toLowerCase().includes('expired') && challengeRetryCount < 1) {
      setChallengeRetryCount(r => r + 1)
      setChallengeId(null)
      setPreparing(true)
      setOtpValue('')
      await doIssueChallenge(true)
      setVerifying(false)
      return
    }
    if (errorMsg.toLowerCase().includes('expired')) {
      setError('Code expired. Sign out and try again.')
      setVerifying(false)
      return
    }

    // Device clock check
    if (errorMsg.toLowerCase().includes('clock') || errorMsg.toLowerCase().includes('time')) {
      setError('Your device clock may be incorrect. Go to Settings and enable automatic time.')
      setVerifying(false)
      return
    }

    await handleAttemptFailed(false)
    setOtpValue('')
  }

  async function handleVerifyRecovery() {
    if (!recoveryValue.trim() || verifying || isLockedOut) return
    setVerifying(true)
    setError(null)

    const ok = await verifyRecoveryCode(recoveryValue.trim())
    if (!mountedRef.current) return
    setVerifying(false)

    if (ok) {
      await clearAttemptCount()
      try { await recordAuthAuditEvent('mfa_recovery_code_used') } catch { /* best-effort */ }
      analytics.twoFactorRecoveryCodeUsed(user?.id ?? null)
      // Recovery code does NOT upgrade Supabase AAL — session-local override only.
      // Session remains AAL1; Rekkus treats this as MFA-satisfied for this session.
      setMfaRequired(false)
      router.replace('/(tabs)/feed')
      return
    }

    await handleAttemptFailed(true)
    setRecoveryValue('')
  }

  function handleOTPChange(text: string) {
    // Strip non-digits, cap at 6
    const digits = text.replace(/\D/g, '').slice(0, 6)
    setOtpValue(digits)
    setError(null)
    if (digits.length === 6) void handleVerifyTOTP(digits)
  }

  function handleSignOut() {
    Alert.alert(
      'Sign out?',
      'You can return by signing in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => { void signOut() } },
      ]
    )
  }

  const email = user?.email ?? ''

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Verify it's you
          </Text>

          {mode === 'totp' ? (
            <>
              <Text style={styles.body} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                This account is protected with two-factor authentication.
                {'\n'}Enter the 6-digit code from your authenticator app.
              </Text>
              {user?.app_metadata?.provider === 'google' || user?.app_metadata?.provider === 'apple' ? (
                <Text style={styles.oauthNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  For extra security, this account requires a second verification step.
                </Text>
              ) : null}

              {preparing ? (
                <View style={styles.preparingWrap}>
                  <ActivityIndicator size="small" color={colors.text3} />
                  <Text style={styles.preparingText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                    Preparing verification…
                  </Text>
                </View>
              ) : (
                <TextInput
                  ref={inputRef}
                  style={styles.otpInput}
                  value={otpValue}
                  onChangeText={handleOTPChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.text3}
                  editable={!isLockedOut && !verifying}
                  autoFocus
                  accessibilityLabel="6-digit verification code"
                  accessibilityHint="Enter the code from your authenticator app"
                />
              )}

              {isLockedOut ? (
                <Text style={styles.lockoutText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Too many attempts. Try again in {lockoutSecondsLeft}s.
                </Text>
              ) : null}

              {error ? <ErrorMessage message={error} /> : null}

              {verifying ? (
                <ActivityIndicator size="small" color={colors.text} style={styles.spinner} />
              ) : null}

              <TouchableOpacity
                style={styles.recoveryLink}
                onPress={() => { setMode('recovery'); setError(null); setOtpValue('') }}
                accessibilityRole="button"
              >
                <Text style={styles.recoveryLinkText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Can't access your authenticator?
                </Text>
                <Text style={styles.recoveryLinkAction} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Use a recovery code
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.body} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Enter one of your recovery codes.{'\n'}Each code can only be used once.
              </Text>

              <TextInput
                style={styles.recoveryInput}
                value={recoveryValue}
                onChangeText={text => { setRecoveryValue(text); setError(null) }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={colors.text3}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLockedOut && !verifying}
                autoFocus
                accessibilityLabel="Recovery code"
                accessibilityHint="Enter one of your 16-character recovery codes"
              />

              {isLockedOut ? (
                <Text style={styles.lockoutText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Too many attempts. Try again in {lockoutSecondsLeft}s.
                </Text>
              ) : null}

              {error ? <ErrorMessage message={error} /> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (isLockedOut || verifying || !recoveryValue.trim()) && styles.primaryBtnDisabled]}
                onPress={handleVerifyRecovery}
                disabled={isLockedOut || verifying || !recoveryValue.trim()}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeLink}
                onPress={() => { setMode('totp'); setError(null); setRecoveryValue('') }}
                accessibilityRole="button"
              >
                <Text style={styles.switchModeLinkText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Use authenticator app instead
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
          {email ? (
            <Text style={styles.footerEmail} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              Signed in as {email}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={handleSignOut}
            accessibilityRole="button"
            style={styles.signOutBtn}
          >
            <Text style={styles.signOutText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              Sign out and try again
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.bg },
    content: {
      flex: 1,
      paddingHorizontal: spacing[5],
      paddingTop: spacing.px40,
      gap: spacing[4],
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      color: c.text,
      marginBottom: spacing[1],
    },
    body: {
      fontSize: fontSize.md,
      color: c.text2,
      lineHeight: lineHeight.body,
    },
    oauthNote: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      lineHeight: lineHeight.body,
    },
    preparingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[4],
    },
    preparingText: {
      fontSize: fontSize.md,
      color: c.text3,
    },
    otpInput: {
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.medium,
      letterSpacing: 8,
      color: c.text,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      paddingVertical: spacing[2],
      textAlign: 'center',
    },
    recoveryInput: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      borderWidth: 1,
      borderColor: c.border,
    },
    lockoutText: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      fontWeight: fontWeight.medium,
    },
    spinner: { alignSelf: 'flex-start' },
    recoveryLink: {
      marginTop: spacing[2],
      gap: spacing.px6,
    },
    recoveryLinkText: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    recoveryLinkAction: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    switchModeLink: {
      alignSelf: 'flex-start',
    },
    switchModeLinkText: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px14,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      color: c.bg,
    },
    footer: {
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[4],
      gap: spacing[2],
      alignItems: 'center',
    },
    footerEmail: {
      fontSize: fontSize.bodySm,
      color: c.text3,
    },
    signOutBtn: {
      paddingVertical: spacing[2],
    },
    signOutText: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      textDecorationLine: 'underline',
    },
  })
}
