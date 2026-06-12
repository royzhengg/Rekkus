import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path } from 'react-native-svg'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontFamily, fontSize, fontWeight, letterSpacing, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

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

export default function WelcomeScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>
          rekkus<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.tagline}>Discover the best dishes near you.</Text>
        <Text style={styles.subTagline}>Real reviews from real people.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/signup')} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>Create account</Text>
        </TouchableOpacity>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        <TouchableOpacity style={styles.googleBtn} onPress={() => router.push('/(auth)/login')}>
          <GoogleIcon />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')} accessibilityRole="button">
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
        <Text style={styles.terms}>
          By continuing you agree to our <Text style={styles.termsLink}>terms</Text> and{' '}
          <Text style={styles.termsLink}>privacy policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: spacing[4] },
    brand: { flex: 1, justifyContent: 'center', paddingBottom: spacing[5] },
    wordmark: {
      fontFamily: fontFamily.serif,
      fontSize: fontSize.display,
      color: c.text,
      letterSpacing: letterSpacing.display,
      marginBottom: spacing[4],
    },
    dot: { color: c.accent },
    tagline: { fontSize: fontSize['2.5xl'], color: c.text, lineHeight: lineHeight.hero, letterSpacing: letterSpacing.tighterHeading, marginBottom: spacing[2] },
    subTagline: { fontSize: fontSize.lg, color: c.text2, letterSpacing: letterSpacing.snug },
    actions: { paddingBottom: spacing[2], gap: spacing.px10 },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
    },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
    secondaryBtn: {
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: spacing.px15,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border2,
    },
    secondaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginVertical: spacing.px2 },
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
    },
    googleBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    forgotBtn: { alignItems: 'center', paddingVertical: spacing[2] },
    forgotText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: c.info },
    terms: { fontSize: fontSize.sm, color: c.text3, textAlign: 'center', lineHeight: lineHeight.tight, marginTop: spacing[1] },
    termsLink: { color: c.info },
  })
}
