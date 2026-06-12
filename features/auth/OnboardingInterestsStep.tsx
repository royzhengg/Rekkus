import { useRouter } from 'expo-router'
import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Polyline } from 'react-native-svg'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { getCurrentUser } from '@/lib/services/auth'
import { ONBOARDING_TOPICS, saveTopicFollows } from '@/lib/services/topics'

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

export default function OnboardingInterestsStep() {
  const router = useRouter()
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canContinue = selected.length >= 3

  function toggleTopic(topic: string) {
    setSelected(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  async function handleContinue() {
    if (!canContinue || loading) return
    setError('')
    if (!requireOnline()) {
      setError('Reconnect to save your interests.')
      return
    }
    setLoading(true)
    try {
      const currentUser = user ?? await getCurrentUser()
      if (currentUser) {
        await saveTopicFollows(currentUser.id, selected, 'onboarding')
        analytics.onboardingStep(currentUser.id, 'interests_step', 'success')
      }
    } catch {
      setLoading(false)
      setError('Could not save your interests. Please try again.')
      return
    }
    setLoading(false)
    router.push('/(auth)/onboarding-location')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>2 of 3</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>What do you love?</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.5}>
          Choose at least 3 to tune your Discover feed.
        </Text>

        {error ? <ErrorMessage message={error} /> : null}

        <View style={styles.topicGrid}>
          {ONBOARDING_TOPICS.map(topic => {
            const active = selected.includes(topic)
            return (
              <TouchableOpacity
                key={topic}
                style={[styles.topicChip, active && styles.topicChipActive]}
                onPress={() => toggleTopic(topic)}
                accessibilityRole="button"
                accessibilityLabel={`${topic}${active ? ', selected' : ''}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.topicText, active && styles.topicTextActive]}>
                  {topic}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.selectedCount} maxFontSizeMultiplier={1.5}>
          {selected.length} selected{selected.length < 3 ? ` — pick ${3 - selected.length} more` : ''}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
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
    scroll: { padding: spacing[4], paddingTop: spacing.px28, paddingBottom: spacing[8] },
    title: { fontSize: fontSize['5xl'], fontWeight: fontWeight.medium, color: c.text, marginBottom: spacing[1], letterSpacing: letterSpacing.tightHeading },
    subtitle: { fontSize: fontSize.md, color: c.text2, marginBottom: spacing.px28 },
    topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
    topicChip: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing.px7,
      minHeight: 44,
      justifyContent: 'center',
    },
    topicChipActive: { backgroundColor: c.text, borderColor: c.text },
    topicText: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    topicTextActive: { color: c.bg },
    selectedCount: { fontSize: fontSize.sm, color: c.text3, marginBottom: spacing[5] },
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
