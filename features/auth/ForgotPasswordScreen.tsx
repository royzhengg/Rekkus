import { useRouter } from 'expo-router'
import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const { resetPasswordForEmail } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const canSubmit = email.trim().length > 0

  async function handleSend() {
    if (!canSubmit || loading) return
    setError('')
    setLoading(true)
    const err = await resetPasswordForEmail(email.trim())
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Reset password</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          {sent ? (
            <>
              <Text style={styles.title}>Check your inbox</Text>
              <Text style={styles.subtitle}>
                We've sent a password reset link to{' '}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>. Tap the link in the
                email to set a new password.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
                <Text style={styles.primaryBtnText}>Back to sign in</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              {error ? <ErrorMessage message={error} /> : null}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.text3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
                onPress={handleSend}
                disabled={!canSubmit || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Send reset link</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
    topTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    body: { padding: spacing[4], paddingTop: spacing[8] },
    title: {
      fontSize: fontSize['5xl'],
      fontWeight: fontWeight.medium,
      color: c.text,
      marginBottom: spacing.px10,
      letterSpacing: -0.3,
    },
    subtitle: { fontSize: fontSize.md, color: c.text2, lineHeight: lineHeight.normal, marginBottom: spacing.px28 },
    emailHighlight: { color: c.text, fontWeight: fontWeight.medium },
    label: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2, marginBottom: spacing.px6 },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px13,
      fontSize: fontSize.md,
      color: c.text,
      marginBottom: spacing[5],
    },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
  })
}
