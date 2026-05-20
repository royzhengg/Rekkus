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
import { Svg, Polyline } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { analytics } from '@/lib/analytics'
import { ONBOARDING_TOPICS, saveTopicFollows } from '@/lib/services/topics'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'

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

export default function SignupProfileScreen() {
  const router = useRouter()
  const { updateProfile } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [city, setCity] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit =
    username.trim().length >= 3 && displayName.trim().length >= 1 && selectedTopics.length >= 3

  const cleanUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)

  async function handleFinish() {
    if (!canSubmit || loading) return
    setError('')
    setLoading(true)
    const err = await updateProfile(cleanUsername, displayName.trim())
    if (err) {
      setLoading(false)
      setError(err)
      return
    }
    const loc = { suburb: suburb.trim() || null, city: city.trim() || null }
    if (loc.suburb || loc.city) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await (supabase.from('users') as any).update(loc).eq('id', user.id)
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await saveTopicFollows(user.id, selectedTopics, 'onboarding')
      analytics.onboardingStep(user.id, 'interest_onboarding', 'success')
    }
    setLoading(false)
    router.replace('/(tabs)/feed')
  }

  function toggleTopic(topic: string) {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
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
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>One last step.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          />

          <Text style={[styles.label, { marginTop: spacing[1] }]}>
            Suburb <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Surry Hills"
            placeholderTextColor={colors.text3}
            value={suburb}
            onChangeText={setSuburb}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: spacing[1] }]}>
            City <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Sydney"
            placeholderTextColor={colors.text3}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleFinish}
          />

          <Text style={[styles.label, { marginTop: spacing[1] }]}>Food interests</Text>
          <Text style={styles.hint}>Choose at least 3 to tune your Discover feed.</Text>
          <View style={styles.topicGrid}>
            {ONBOARDING_TOPICS.map(topic => {
              const active = selectedTopics.includes(topic)
              return (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, active && styles.topicChipActive]}
                  onPress={() => toggleTopic(topic)}
                >
                  <Text style={[styles.topicText, active && styles.topicTextActive]}>
                    {topic}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={handleFinish}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Complete profile</Text>
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
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], padding: spacing.px6, marginLeft: -spacing.px6 },
    backText: { fontSize: fontSize.md, color: c.text2 },
    scroll: { padding: spacing[4], paddingTop: spacing.px28 },
    title: { fontSize: fontSize['5xl'], fontWeight: fontWeight.medium, color: c.text, marginBottom: spacing[1], letterSpacing: -0.3 },
    subtitle: { fontSize: fontSize.md, color: c.text2, marginBottom: spacing.px28 },
    errorText: {
      fontSize: fontSize.base,
      color: c.liked,
      backgroundColor: c.errorBg,
      borderRadius: radius.sm3,
      padding: spacing.px10,
      marginBottom: spacing[4],
      lineHeight: lineHeight.small,
    },
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
      marginBottom: spacing.px28,
    },
    topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing.px28 },
    topicChip: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px7,
    },
    topicChipActive: { backgroundColor: c.text, borderColor: c.text },
    topicText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    topicTextActive: { color: c.bg },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
    optional: { fontWeight: fontWeight.regular, color: c.text3 },
  })
}
