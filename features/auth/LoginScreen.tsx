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
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Polyline, Path, Circle } from 'react-native-svg'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isValidPassword } from '@/lib/utils/validation'

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

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  )
}

export default function LoginScreen() {
  const router = useRouter()
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const canSubmit = email.trim().length > 0 && isValidPassword(password)

  async function handleSignIn() {
    if (!canSubmit || loading) return
    setError('')
    setLoading(true)
    const err = await signInWithEmail(email.trim(), password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      router.replace('/(tabs)/feed')
    }
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    const err = await signInWithGoogle()
    setGoogleLoading(false)
    if (err) setError(err)
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
          <Text style={styles.title}>Sign in</Text>

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
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              placeholder="Password"
              placeholderTextColor={colors.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              style={styles.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={handleSignIn}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
              <Text style={styles.switchLink}>Create account</Text>
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
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2 },
    scroll: { padding: spacing[4], paddingTop: spacing.px28 },
    title: {
      fontSize: fontSize['5xl'],
      fontWeight: fontWeight.medium,
      color: c.text,
      marginBottom: spacing[6],
      letterSpacing: -0.3,
    },
    label: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2, marginBottom: spacing.px6 },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px13,
      fontSize: fontSize.md,
      color: c.text,
      marginBottom: spacing[4],
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      marginBottom: spacing[5],
    },
    inputInner: { flex: 1, paddingVertical: spacing.px13, fontSize: fontSize.md, color: c.text },
    eyeBtn: { padding: spacing[1] },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
      marginBottom: spacing.px14,
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
    forgotBtn: { alignItems: 'center', marginBottom: spacing[5] },
    forgotText: { fontSize: fontSize.base, color: c.info },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing.px14 },
    dividerLine: { flex: 1, height: 0.5, backgroundColor: c.border },
    dividerText: { fontSize: fontSize.bodySm, color: c.text3 },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.px10,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      borderWidth: 0.5,
      borderColor: c.border2,
      marginBottom: spacing.px28,
    },
    googleBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    switchText: { fontSize: fontSize.base, color: c.text3 },
    switchLink: { fontSize: fontSize.base, color: c.info, fontWeight: fontWeight.medium },
  })
}
