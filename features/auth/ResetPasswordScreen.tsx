import { useRouter } from 'expo-router'
import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { EyeIcon } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { updatePassword } from '@/lib/services/auth'
import { isValidPassword, passwordMinLengthMessage, passwordsMatch as doPasswordsMatch } from '@/lib/utils/validation'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordsMatch = doPasswordsMatch(password, confirm)
  const canSave = isValidPassword(password) && confirm.length > 0 && passwordsMatch

  async function handleSave() {
    if (!canSave || loading) return
    setError(null)
    if (!requireOnline()) {
      setError('Reconnect to update your password.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
    } catch (updateError) {
      setLoading(false)
      setError(updateError instanceof Error ? updateError.message : 'Failed to update password.')
      return
    }
    setLoading(false)
    Alert.alert('Password updated', 'Your new password has been set.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <View style={{ width: 36 }} />
        <Text style={styles.topTitle}>Set new password</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.form}>
        <Text style={styles.subtitle}>Choose a password {passwordMinLengthMessage().toLowerCase()} long.</Text>

        {error ? <ErrorMessage message={error} /> : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder={passwordMinLengthMessage()}
              placeholderTextColor={colors.text3}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
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
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm password</Text>
          <View
            style={[
              styles.inputWrap,
              !passwordsMatch && confirm.length > 0 && styles.inputError,
            ]}
          >
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
            >
              <EyeIcon open={showConfirm} />
            </TouchableOpacity>
          </View>
          {!passwordsMatch && confirm.length > 0 ? (
            <Text style={styles.matchError}>Passwords don't match</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.primaryBtnText}>Set password</Text>
          )}
        </TouchableOpacity>
      </View>
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
    topTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    form: { padding: spacing[4], paddingTop: spacing[6], gap: spacing[4] },
    subtitle: { fontSize: fontSize.md, color: c.text2, lineHeight: lineHeight.normal },
    fieldGroup: { gap: spacing.px6 },
    label: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      borderWidth: 1,
      borderColor: 'transparent',
    },
    inputError: { borderColor: c.liked },
    input: { fontSize: fontSize.md, color: c.text },
    matchError: { fontSize: fontSize.bodySm, color: c.liked },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      marginTop: spacing[2],
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
  })
}
