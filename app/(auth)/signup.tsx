import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Svg, Polyline, Path, Circle } from 'react-native-svg'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'

function ChevronLeft() {
  const colors = useThemeColors()
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text2}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  const colors = useThemeColors()
  return open ? (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  ) : (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text3}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path d="M1 1l22 22" />
    </Svg>
  )
}

export default function SignupScreen() {
  const router = useRouter()
  const { signUpWithEmail } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsMatch = password === confirm
  const canSubmit = email.trim().length > 0 && password.length >= 8 && passwordsMatch

  async function handleContinue() {
    if (!canSubmit || loading) return
    setError('')
    setLoading(true)
    const err = await signUpWithEmail(email.trim(), password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      router.push('/(auth)/signup-profile')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create account</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <EyeIcon open={showPassword} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <View style={[styles.inputWrap, { marginBottom: 8 }]}>
            <TextInput
              style={styles.inputInner}
              placeholder="Repeat password"
              placeholderTextColor={colors.text3}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
              <EyeIcon open={showConfirm} />
            </TouchableOpacity>
          </View>

          {confirm.length > 0 && !passwordsMatch && (
            <Text style={styles.validationText}>Passwords don't match</Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled, { marginTop: 20 }]}
            onPress={handleContinue}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Continue →</Text>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.switchLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: -6 },
    backText: { fontSize: 14, color: c.text2 },
    scroll: { padding: 16, paddingTop: 28 },
    title: {
      fontSize: 26,
      fontWeight: '500',
      color: c.text,
      marginBottom: 24,
      letterSpacing: -0.3,
    },
    errorText: {
      fontSize: 13,
      color: c.liked,
      backgroundColor: '#FEF0F0',
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
      lineHeight: 18,
    },
    validationText: { fontSize: 12, color: c.liked, marginBottom: 4 },
    label: { fontSize: 12, fontWeight: '500', color: c.text2, marginBottom: 6 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: c.text,
      marginBottom: 16,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    inputInner: { flex: 1, paddingVertical: 13, fontSize: 14, color: c.text },
    eyeBtn: { padding: 4 },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 24,
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: 15, fontWeight: '500', color: c.bg },
    switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    switchText: { fontSize: 13, color: c.text3 },
    switchLink: { fontSize: 13, color: c.info, fontWeight: '500' },
  })
}
