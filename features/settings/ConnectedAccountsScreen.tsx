import { useRouter } from 'expo-router'
import React, { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path } from 'react-native-svg'
import { ArrowLeft } from '@/components/icons'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, lineHeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
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

export default function ConnectedAccountsScreen() {
  const router = useRouter()
  const { user, linkGoogle, unlinkIdentity } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const identities = user?.identities ?? []
  const googleIdentity = identities.find(i => i.provider === 'google')
  const isGoogleConnected = !!googleIdentity
  // Safe to unlink only if another identity exists (email/password or other provider)
  const canUnlinkGoogle = identities.length > 1

  async function handleGoogleConnect() {
    setError(null)
    if (!requireOnline()) {
      setError('Reconnect to connect an account.')
      return
    }
    setLoading(true)
    const err = await linkGoogle()
    setLoading(false)
    if (err) setError(err)
  }

  async function handleGoogleDisconnect() {
    if (!googleIdentity) return
    if (!requireOnline()) {
      setError('Reconnect to disconnect an account.')
      return
    }
    if (!canUnlinkGoogle) {
      Alert.alert(
        'Cannot disconnect',
        'Google is your only sign-in method. Set a password first before disconnecting.'
      )
      return
    }
    Alert.alert('Disconnect Google', 'Are you sure you want to remove Google sign-in?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => { void (async () => {
          setError(null)
          setLoading(true)
          const err = await unlinkIdentity(googleIdentity)
          setLoading(false)
          if (err) setError(err)
        })() },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Connected accounts</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.scroll}>
        {error ? <ErrorMessage title="Could not update connected account" message={error} /> : null}
        <Text style={styles.sectionHeader}>SOCIAL</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <GoogleIcon />
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Google</Text>
              {isGoogleConnected ? (
                <Text style={styles.rowSublabel}>
                  {googleIdentity?.identity_data?.email ?? 'Connected'}
                </Text>
              ) : null}
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={colors.text3} />
            ) : isGoogleConnected ? (
              <TouchableOpacity onPress={handleGoogleDisconnect} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.actionDisconnect}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleGoogleConnect} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.actionConnect}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.hint}>
          Connected accounts let you sign in to Rekkus without a password.
        </Text>
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
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    scroll: { paddingTop: spacing[2] },
    sectionHeader: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      letterSpacing: letterSpacing.loose,
      textTransform: 'uppercase',
      marginTop: spacing[5],
      marginBottom: spacing.px6,
      marginHorizontal: spacing[4],
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      marginHorizontal: spacing[4],
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px14,
      gap: spacing[3],
    },
    rowMeta: { flex: 1 },
    rowLabel: { fontSize: fontSize.md, color: c.text },
    rowSublabel: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    actionConnect: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.info },
    actionDisconnect: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.liked },
    hint: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      marginHorizontal: spacing[4],
      marginTop: spacing.px10,
      lineHeight: lineHeight.compact,
    },
  })
}
