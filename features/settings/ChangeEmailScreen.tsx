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
import { ArrowLeft } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/contexts/AuthContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

export default function ChangeEmailScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = newEmail.trim().includes('@') && password.length >= 6

  async function handleSave() {
    setError(null)
    setLoading(true)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    if (!currentUser?.email) {
      setError("We couldn't verify your identity. Please try again.")
      setLoading(false)
      return
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    })
    if (signInError) {
      setError("That password doesn't match. Please try again.")
      setLoading(false)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    Alert.alert(
      'Verify your new email',
      `We've sent a confirmation link to ${newEmail}. Tap it to complete the change.`,
      [{ text: 'OK', onPress: () => router.back() }]
    )
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
        <Text style={styles.title}>Change email</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current email</Text>
          <View style={styles.readonlyInput}>
            <Text style={styles.readonlyText}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New email</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.text3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your current password"
            placeholderTextColor={colors.text3}
            secureTextEntry
          />
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
            <Text style={styles.primaryBtnText}>Update email</Text>
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
    readonlyInput: {
      backgroundColor: c.surface2,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
    },
    readonlyText: { fontSize: fontSize.md, color: c.text2 },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      fontSize: fontSize.md,
      color: c.text,
    },
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
    errorText: { fontSize: fontSize.base, color: c.liked },
  })
}
