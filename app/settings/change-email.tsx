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
import { useThemeColors } from '@/lib/ThemeContext'
import { ArrowLeft } from '@/components/icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

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
      setError('Unable to verify current account.')
      setLoading(false)
      return
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    })
    if (signInError) {
      setError('Current password is incorrect.')
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
      `We've sent a confirmation link to ${newEmail}. Click it to complete the change.`,
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
            placeholder="your@email.com"
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 56, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '500', color: c.text },
    form: { padding: 16, gap: 16, paddingTop: 24 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 12, fontWeight: '500', color: c.text2 },
    readonlyInput: {
      backgroundColor: c.surface2,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    readonlyText: { fontSize: 14, color: c.text2 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.text,
    },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: 15, fontWeight: '500', color: c.bg },
    errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 },
    errorText: { fontSize: 13, color: '#B91C1C' },
  })
}
