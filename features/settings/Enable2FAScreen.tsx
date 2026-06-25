import * as Clipboard from 'expo-clipboard'
import { Paths, File as FSFile } from 'expo-file-system'
import { useRouter } from 'expo-router'
import * as Sharing from 'expo-sharing'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
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
import type { EnrollTOTPResult } from '@/lib/services/auth/mfa'
import { BackButton } from './SettingsControlDock'

type Step = 'warning' | 'qr' | 'recovery'

export default function Enable2FAScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { beginEnrollment, issueChallenge, confirmEnrollment, generateRecoveryCodes } = useMFA()
  const { showToast } = useToast()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [step, setStep] = useState<Step>('warning')
  const [enrollment, setEnrollment] = useState<EnrollTOTPResult | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [otpValue, setOtpValue] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [confirmCode, setConfirmCode] = useState('')
  const [ackChecked, setAckChecked] = useState(false)
  const [enrollmentComplete, setEnrollmentComplete] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [qrError, setQrError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyAttempts, setVerifyAttempts] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    analytics.twoFactorSetupStarted(user?.id ?? null)
    return () => {
      mountedRef.current = false
    }
  }, [user?.id])

  // Abandoned event: fires on unmount if enrollment was not completed
  useEffect(() => {
    return () => {
      if (!enrollmentComplete) {
        analytics.twoFactorSetupAbandoned(user?.id ?? null)
      }
    }
  }, [enrollmentComplete, user?.id])

  async function handleContinueFromWarning() {
    setEnrolling(true)
    setError(null)
    const result = await beginEnrollment()
    setEnrolling(false)
    if (!mountedRef.current) return
    if ('error' in result) {
      setError(result.error)
      return
    }
    setEnrollment(result)
    // Issue challenge immediately so it's ready when user enters the code
    const challengeResult = await issueChallenge(result.factorId)
    if ('error' in challengeResult) {
      setError('Could not start enrollment. Please try again.')
      return
    }
    setChallengeId(challengeResult.challengeId)
    setStep('qr')
    analytics.twoFactorSetupQrShown(user?.id ?? null)
  }

  async function handleVerifyOTP() {
    if (!enrollment || !challengeId || !otpValue || verifying) return
    setVerifying(true)
    setError(null)
    const errorMsg = await confirmEnrollment(enrollment.factorId, challengeId, otpValue)
    if (!mountedRef.current) return
    setVerifying(false)
    if (errorMsg) {
      const attempts = verifyAttempts + 1
      setVerifyAttempts(attempts)
      analytics.twoFactorSetupVerificationFailed(user?.id ?? null, attempts)
      setError('Incorrect code. Check the code and try again.')
      setOtpValue('')
      return
    }
    // Move to recovery codes step — generate and persist BEFORE display
    setStep('recovery')
    await handleGenerateCodes()
  }

  async function handleGenerateCodes() {
    setGeneratingCodes(true)
    setError(null)
    const result = await generateRecoveryCodes()
    if (!mountedRef.current) return
    setGeneratingCodes(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setRecoveryCodes(result)
    try { await recordAuthAuditEvent('mfa_enrolled') } catch { /* best-effort */ }
    analytics.twoFactorSetupCompleted(user?.id ?? null)
  }

  async function handleCopyAll() {
    await Clipboard.setStringAsync(recoveryCodes.join('\n'))
    showToast('Recovery codes copied')
  }

  async function handleSaveToFiles() {
    const email = user?.email ?? 'unknown'
    const timestamp = new Date().toISOString()
    const content = [
      'WARNING: These codes can be used to access your Rekkus account. Store them securely.',
      '',
      'Rekkus recovery codes',
      `Account: ${email}`,
      `Generated: ${timestamp}`,
      '',
      ...recoveryCodes.map((c, i) => `Code ${i + 1}: ${c}`),
    ].join('\n')

    const file = new FSFile(Paths.cache, 'rekkus-recovery-codes.txt')
    file.write(content)
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Save recovery codes' })
    } else {
      showToast('File sharing not available on this device')
    }
  }

  function handleOTPChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6)
    setOtpValue(digits)
    setError(null)
  }

  const thirdCode = recoveryCodes[2] ?? ''
  const confirmNormalised = confirmCode.replace(/[\s-]/g, '').toUpperCase()
  const thirdNormalised = thirdCode.replace(/[\s-]/g, '').toUpperCase()
  const confirmMatches = confirmNormalised === thirdNormalised && confirmNormalised.length === 16
  const canComplete = ackChecked && confirmMatches && recoveryCodes.length === 8

  function handleDone() {
    if (!canComplete) return
    setEnrollmentComplete(true)
    router.back()
    showToast('Two-factor authentication is now active')
  }

  const stepLabel =
    step === 'warning' ? 'Step 1 of 3 · Install & Scan' :
    step === 'qr' ? 'Step 2 of 3 · Verify' :
    'Step 3 of 3 · Save Recovery Codes'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Set up 2FA"
        left={<BackButton onPress={() => router.back()} />}
        right={<View style={styles.headerSpacer} />}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.stepLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            {stepLabel}
          </Text>

          {step === 'warning' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                Set up two-factor authentication
              </Text>
              <View style={styles.steps}>
                {[
                  ['📱', 'Install an authenticator app'],
                  ['🔍', 'Scan a QR code'],
                  ['📝', 'Save your recovery codes'],
                ].map(([icon, text]) => (
                  <View key={text} style={styles.stepRow}>
                    <Text style={styles.stepIcon}>{icon}</Text>
                    <Text style={styles.stepText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>{text}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Takes about 2 minutes.
              </Text>
              <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Supported apps: Google Authenticator, Microsoft Authenticator, Authy
              </Text>
              <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                You can scan the QR code on multiple devices before completing setup.
              </Text>
              <View style={styles.warningBox}>
                <Text style={styles.warningText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                  Important: If you lose access to all your authenticator apps and your recovery codes, we cannot recover your account. Many users scan the QR into multiple apps — this is fine.
                </Text>
              </View>
              {error ? <ErrorMessage message={error} /> : null}
              <TouchableOpacity
                style={[styles.primaryBtn, enrolling && styles.primaryBtnDisabled]}
                onPress={handleContinueFromWarning}
                disabled={enrolling}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {enrolling ? <ActivityIndicator size="small" color={colors.bg} /> : (
                  <Text style={styles.primaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'qr' && enrollment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                Scan with your authenticator app
              </Text>
              <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Open your authenticator app and scan this QR code.
              </Text>
              {!qrError ? (
                <View style={styles.qrContainer}>
                  <Image
                    source={{ uri: enrollment.qrCode }}
                    style={styles.qrImage}
                    onError={() => setQrError(true)}
                    accessibilityLabel="QR code for authenticator setup"
                  />
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(enrollment.secret)
                  showToast('Secret copied')
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>
                  {qrError ? 'Copy secret (QR unavailable)' : "Can't scan? Copy secret"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                Enter the 6-digit code to verify
              </Text>
              <TextInput
                style={styles.otpInput}
                value={otpValue}
                onChangeText={handleOTPChange}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.text3}
                editable={!verifying}
                accessibilityLabel="6-digit verification code"
              />
              {error ? <ErrorMessage message={error} /> : null}
              <TouchableOpacity
                style={[styles.primaryBtn, (otpValue.length !== 6 || verifying) && styles.primaryBtnDisabled]}
                onPress={handleVerifyOTP}
                disabled={otpValue.length !== 6 || verifying}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {verifying ? <ActivityIndicator size="small" color={colors.bg} /> : (
                  <Text style={styles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'recovery' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                ⚠️ Save these recovery codes
              </Text>
              <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                These are your only backup if you lose access to all your authenticator apps.
                We cannot recover your account if both are lost.
              </Text>
              {generatingCodes ? (
                <View style={styles.generatingWrap}>
                  <ActivityIndicator size="small" color={colors.text3} />
                  <Text style={styles.generatingText}>Generating codes…</Text>
                </View>
              ) : error ? (
                <View style={styles.section}>
                  <ErrorMessage message={error} />
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handleGenerateCodes}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.codeList}>
                    {recoveryCodes.map((code, i) => (
                      <View key={i} style={styles.codeRow}>
                        <Text style={styles.codeIndex}>{i + 1}.</Text>
                        <Text style={styles.codeValue} selectable accessibilityLabel={`Code ${i + 1}: ${code}`}>
                          {code}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={handleCopyAll}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Copy all</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={handleSaveToFiles}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryBtnText}>Save to Files</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.ackRow}>
                    <TouchableOpacity
                      style={[styles.checkbox, ackChecked && styles.checkboxChecked]}
                      onPress={() => setAckChecked(v => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ackChecked }}
                      accessibilityLabel="I've saved my recovery codes"
                    >
                      {ackChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                    </TouchableOpacity>
                    <Text style={styles.ackText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                      I've saved my recovery codes
                    </Text>
                  </View>

                  <View style={styles.confirmSection}>
                    <Text style={styles.fieldLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
                      Enter code #3 to confirm
                    </Text>
                    <TextInput
                      style={[styles.confirmInput, confirmCode.length > 0 && !confirmMatches && styles.confirmInputError]}
                      value={confirmCode}
                      onChangeText={text => setConfirmCode(text)}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      placeholderTextColor={colors.text3}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      accessibilityLabel="Confirm code 3"
                    />
                    {confirmCode.length > 0 && !confirmMatches && confirmCode.replace(/[\s-]/g, '').length >= 16 ? (
                      <Text style={styles.confirmError}>That doesn't match code #3. Check and try again.</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
                    onPress={handleDone}
                    disabled={!canComplete}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: c.bg },
    headerSpacer: { width: spacing.px36 },
    scroll: { padding: spacing[4], paddingBottom: spacing.px40, gap: spacing[4] },
    stepLabel: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      fontWeight: fontWeight.medium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    section: { gap: spacing[4] },
    sectionTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      color: c.text,
    },
    steps: { gap: spacing[2] },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    stepIcon: { fontSize: fontSize.xl, width: 28 },
    stepText: { fontSize: fontSize.md, color: c.text2, flex: 1 },
    bodyText: {
      fontSize: fontSize.md,
      color: c.text2,
      lineHeight: lineHeight.body,
    },
    warningBox: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      padding: spacing[4],
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
    },
    warningText: {
      fontSize: fontSize.bodySm,
      color: c.text2,
      lineHeight: lineHeight.body,
    },
    qrContainer: {
      alignItems: 'center',
      padding: spacing[4],
      backgroundColor: c.white,
      borderRadius: radius.lg,
    },
    qrImage: {
      width: 200,
      height: 200,
    },
    fieldLabel: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.medium,
      color: c.text2,
    },
    otpInput: {
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.medium,
      letterSpacing: 8,
      color: c.text,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      paddingVertical: spacing[2],
      textAlign: 'center',
    },
    codeList: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing[4],
      gap: spacing[2],
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    codeIndex: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      width: 20,
    },
    codeValue: {
      fontSize: fontSize.md,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: c.text,
      letterSpacing: 1,
    },
    codeActions: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    ackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: c.text,
      borderColor: c.text,
    },
    checkmark: {
      fontSize: fontSize.base,
      color: c.bg,
      fontWeight: fontWeight.bold,
    },
    ackText: {
      fontSize: fontSize.md,
      color: c.text,
      flex: 1,
    },
    confirmSection: { gap: spacing[2] },
    confirmInput: {
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
    confirmInputError: {
      borderColor: c.liked,
    },
    confirmError: {
      fontSize: fontSize.bodySm,
      color: c.liked,
    },
    generatingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[4],
    },
    generatingText: {
      fontSize: fontSize.md,
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
    secondaryBtn: {
      flex: 1,
      borderRadius: radius.md3,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
  })
}
