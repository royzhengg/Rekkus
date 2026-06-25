// Re-auth gate — required before disabling MFA and other sensitive actions.
// Email accounts: password prompt. OAuth-only: TOTP challenge.

import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { EyeIcon } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useMFA } from '@/lib/hooks/useMFA'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { getCurrentUser, reauthenticate } from '@/lib/services/auth'

interface Props {
  visible: boolean
  hasEmailIdentity: boolean
  factorId?: string | undefined
  onSuccess: () => void
  onCancel: () => void
}

export function MFAReauthModal({ visible, hasEmailIdentity, factorId, onSuccess, onCancel }: Props) {
  const { issueChallenge, verifyChallenge } = useMFA()
  const reduceMotion = useReducedMotion()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For OAuth-only, issue challenge when modal opens
  React.useEffect(() => {
    if (!visible || hasEmailIdentity || !factorId) return
    void (async () => {
      setLoading(true)
      const result = await issueChallenge(factorId)
      setLoading(false)
      if ('error' in result) {
        setError('Could not start verification. Try again.')
        return
      }
      setChallengeId(result.challengeId)
    })()
  }, [visible, hasEmailIdentity, factorId, issueChallenge])

  function handleClose() {
    setPassword('')
    setTotpCode('')
    setChallengeId(null)
    setError(null)
    onCancel()
  }

  async function handlePasswordSubmit() {
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser?.email) throw new Error('Could not verify identity')
      await reauthenticate(currentUser.email, password)
      setPassword('')
      onSuccess()
    } catch {
      setError("That password doesn't match. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleTOTPSubmit() {
    if (!totpCode.trim() || !challengeId || !factorId) return
    setLoading(true)
    setError(null)
    const errorMsg = await verifyChallenge(factorId, challengeId, totpCode)
    setLoading(false)
    if (errorMsg) {
      setError('Incorrect code. Try again.')
      setTotpCode('')
      return
    }
    setTotpCode('')
    onSuccess()
  }

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} accessibilityRole="button" style={styles.cancelBtn}>
            <Text style={styles.cancelText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Confirm your identity
          </Text>
          <View style={styles.cancelBtn} />
        </View>

        <View style={styles.body}>
          <Text style={styles.bodyText} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            {hasEmailIdentity
              ? 'Enter your current password to continue.'
              : 'Enter the code from your authenticator app to continue.'}
          </Text>

          {error ? <ErrorMessage message={error} /> : null}

          {hasEmailIdentity ? (
            <>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.text3}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordSubmit}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, (!password.trim() || loading) && styles.primaryBtnDisabled]}
                onPress={handlePasswordSubmit}
                disabled={!password.trim() || loading}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator size="small" color={colors.bg} /> : (
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {loading && !challengeId ? (
                <ActivityIndicator size="small" color={colors.text3} style={styles.spinner} />
              ) : (
                <TextInput
                  style={styles.otpInput}
                  value={totpCode}
                  onChangeText={text => { setTotpCode(text.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.text3}
                  autoFocus
                />
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, (totpCode.length !== 6 || loading) && styles.primaryBtnDisabled]}
                onPress={handleTOTPSubmit}
                disabled={totpCode.length !== 6 || loading}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator size="small" color={colors.bg} /> : (
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      height: 56,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    cancelBtn: { width: 60 },
    cancelText: { fontSize: fontSize.md, color: c.text3 },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    body: { padding: spacing[5], gap: spacing[4] },
    bodyText: {
      fontSize: fontSize.md,
      color: c.text2,
      lineHeight: lineHeight.body,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      borderWidth: 1,
      borderColor: c.border,
    },
    input: { fontSize: fontSize.md, color: c.text },
    otpInput: {
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.medium,
      letterSpacing: 6,
      color: c.text,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      paddingVertical: spacing[2],
      textAlign: 'center',
    },
    spinner: { alignSelf: 'center' },
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
  })
}
