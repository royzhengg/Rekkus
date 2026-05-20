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
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { EyeIcon } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordsMatch = password === confirm
  const canSave = password.length >= 8 && confirm.length > 0 && passwordsMatch

  async function handleSave() {
    if (!canSave || loading) return
    setError(null)
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
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
        <Text style={styles.subtitle}>Choose a password at least 8 characters long.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    errorBox: { backgroundColor: c.errorBg, borderRadius: radius.md, padding: spacing[3] },
    errorText: { fontSize: fontSize.base, color: c.errorText },
  })
}
