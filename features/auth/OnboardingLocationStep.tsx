import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path } from 'react-native-svg'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useUserLocation } from '@/lib/hooks/useUserLocation'

export const FIRST_FEED_VISIT_KEY = 'rekkus:first-feed-visit:v1'

function MapPinIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
    </Svg>
  )
}

export default function OnboardingLocationStep() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { requestLocation, status } = useUserLocation()

  const isRequesting = status === 'requesting'

  async function finishOnboarding(granted: boolean) {
    analytics.onboardingStep(user?.id ?? null, 'location_step', granted ? 'granted' : 'denied')
    await AsyncStorage.setItem(FIRST_FEED_VISIT_KEY, '1')
    router.replace('/(tabs)/feed')
  }

  async function handleEnable() {
    const coords = await requestLocation()
    await finishOnboarding(coords !== null)
  }

  async function handleSkip() {
    await finishOnboarding(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MapPinIcon color={colors.accent} />
        </View>

        <Text style={styles.title} maxFontSizeMultiplier={1.3}>Dishes near you.</Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.5}>
          Enable location so Rekkus can show you the best dishes in your area.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, isRequesting && styles.primaryBtnDisabled]}
          onPress={handleEnable}
          disabled={isRequesting}
          accessibilityRole="button"
          accessibilityLabel="Enable location"
        >
          {isRequesting ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.primaryBtnText}>Enable location</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={isRequesting}
          accessibilityRole="button"
          accessibilityLabel="Skip location, not now"
        >
          <Text style={styles.skipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: spacing[4] },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: spacing[6] },
    iconWrap: { marginBottom: spacing[6] },
    title: {
      fontSize: fontSize['5xl'],
      fontWeight: fontWeight.medium,
      color: c.text,
      textAlign: 'center',
      letterSpacing: -0.3,
      marginBottom: spacing[3],
    },
    body: {
      fontSize: fontSize.lg,
      color: c.text2,
      textAlign: 'center',
      lineHeight: fontSize.lg * 1.5,
      maxWidth: 280,
    },
    actions: { paddingBottom: spacing[3], gap: spacing.px10 },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
    skipBtn: { alignItems: 'center', paddingVertical: spacing[3], minHeight: 44, justifyContent: 'center' },
    skipText: { fontSize: fontSize.md, color: c.text3 },
  })
}
