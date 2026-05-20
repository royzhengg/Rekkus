import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { ArrowLeft, EyeIcon } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { supabase } from '@/lib/supabase'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export default function ChangePasswordScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordsMatch = newPassword === confirmPassword
  const canSave = currentPassword.length >= 6 && newPassword.length >= 8 && passwordsMatch

  async function handleSave() {
    setError(null)
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      setError("We couldn't verify your identity. Please try again.")
      setLoading(false)
      return
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      setError("That password doesn't match. Please try again.")
      setLoading(false)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    Alert.alert('Password updated', 'Your password has been changed successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ])
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
        <Text style={styles.title}>Change password</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.form}>
        {error ? <ErrorMessage message={error} style={styles.errorMessage} /> : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showCurrent}
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EyeIcon open={showCurrent} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showNew}
            />
            <TouchableOpacity
              onPress={() => setShowNew(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EyeIcon open={showNew} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm new password</Text>
          <View
            style={[
              styles.inputWrap,
              !passwordsMatch && confirmPassword.length > 0 && styles.inputError,
            ]}
          >
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
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
          {!passwordsMatch && confirmPassword.length > 0 && (
            <Text style={styles.matchError}>Passwords don't match</Text>
          )}
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
            <Text style={styles.primaryBtnText}>Update password</Text>
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
    backBtn: { width: 56, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    form: { padding: spacing[4], gap: spacing[4], paddingTop: spacing[6] },
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
    errorMessage: { marginBottom: spacing[0] },
  })
}
