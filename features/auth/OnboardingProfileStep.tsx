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
import { Svg, Polyline } from 'react-native-svg'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

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

export default function OnboardingProfileStep() {
  const router = useRouter()
  const { user, updateProfile } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const cleanUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)

  const canContinue = cleanUsername.length >= 3 && displayName.trim().length >= 1

  async function handleContinue() {
    if (!canContinue || loading) return
    setError('')
    if (!requireOnline()) {
      setError('Reconnect to save your profile.')
      return
    }
    setLoading(true)
    const err = await updateProfile(cleanUsername, displayName.trim())
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    analytics.onboardingStep(user?.id ?? null, 'profile_step', 'success')
    router.push('/(auth)/onboarding-interests')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>1 of 3</Text>
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
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Your profile</Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.5}>How should people know you?</Text>

          {error ? <ErrorMessage message={error} /> : null}

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="yourhandle"
              placeholderTextColor={colors.text3}
              value={username}
              onChangeText={t =>
                setUsername(
                  t
                    .toLowerCase()
                    .replace(/[^a-z0-9_.]/g, '')
                    .slice(0, 30)
                )
              }
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
            />
          </View>
          <Text style={styles.hint}>Letters, numbers, _ and . only. Min 3 characters.</Text>

          <Text style={[styles.label, { marginTop: spacing[4] }]}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.text3}
            value={displayName}
            onChangeText={setDisplayName}
            textContentType="name"
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled, { marginTop: spacing[5] }]}
            onPress={handleContinue}
            disabled={!canContinue || loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Continue</Text>
            )}
          </TouchableOpacity>
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
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2 },
    stepIndicator: { fontSize: fontSize.sm, color: c.text3 },
    scroll: { padding: spacing[4], paddingTop: spacing.px28 },
    title: { fontSize: fontSize['5xl'], fontWeight: fontWeight.medium, color: c.text, marginBottom: spacing[1], letterSpacing: -0.3 },
    subtitle: { fontSize: fontSize.md, color: c.text2, marginBottom: spacing.px28 },
    label: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2, marginBottom: spacing.px6 },
    usernameWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      marginBottom: spacing.px6,
    },
    atSign: { fontSize: fontSize.md, color: c.text2, marginRight: spacing.px2 },
    usernameInput: { flex: 1, paddingVertical: spacing.px13, fontSize: fontSize.md, color: c.text },
    hint: { fontSize: fontSize.sm, color: c.text3, marginBottom: spacing[1] },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px13,
      fontSize: fontSize.md,
      color: c.text,
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
