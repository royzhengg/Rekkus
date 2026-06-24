import * as AppleAuthentication from 'expo-apple-authentication'
import { useRouter } from 'expo-router'
import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native'
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
import type { AuthIdentity } from '@/lib/services/auth'
import { deriveLinkedAuthProviders, type AuthProvider as AuthProviderName, type OAuthProvider } from '@/lib/utils/authProviders'

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
  const { user, linkIdentity, unlinkIdentity, providerState, reconnectProvider } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [pendingProvider, setPendingProvider] = useState<AuthProviderName | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)

  const identities = user?.identities ?? []
  const linkedProviders = deriveLinkedAuthProviders(user)
  const knownIdentityCount = linkedProviders.length
  const emailIdentity = identities.find(i => i.provider === 'email')
  const appleIdentity = identities.find(i => i.provider === 'apple')
  const googleIdentity = identities.find(i => i.provider === 'google')
  const showApple = appleAvailable || !!appleIdentity

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setAppleAvailable(false)
      return
    }
    let cancelled = false
    void AppleAuthentication.isAvailableAsync()
      .then(available => {
        if (!cancelled) setAppleAvailable(available)
      })
      .catch(() => {
        if (!cancelled) setAppleAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function identityEmail(identity: AuthIdentity | undefined): string | null {
    const identityData: unknown = identity?.identity_data
    if (typeof identityData !== 'object' || identityData === null) return null
    const email = (identityData as { email?: unknown }).email
    return typeof email === 'string' ? email : null
  }

  async function handleConnect(provider: OAuthProvider) {
    setError(null)
    if (!requireOnline()) {
      setError('Reconnect to connect an account.')
      return
    }
    setPendingProvider(provider)
    const err = await linkIdentity(provider)
    setPendingProvider(null)
    if (err) setError(err)
  }

  async function handleReconnect(provider: OAuthProvider) {
    setError(null)
    if (!requireOnline()) {
      setError('Reconnect to re-link your account.')
      return
    }
    setPendingProvider(provider)
    const err = await reconnectProvider(provider)
    setPendingProvider(null)
    if (err) setError(err)
  }

  async function disconnect(identity: AuthIdentity, provider: AuthProviderName) {
    setError(null)
    setPendingProvider(provider)
    const err = await unlinkIdentity(identity)
    setPendingProvider(null)
    if (err) setError(err)
  }

  async function handleDisconnect(identity: AuthIdentity | undefined, provider: AuthProviderName) {
    if (!identity) return
    if (!requireOnline()) {
      setError('Reconnect to disconnect an account.')
      return
    }
    if (knownIdentityCount <= 1) {
      Alert.alert(
        'Cannot disconnect',
        `${providerLabel(provider)} is your only sign-in method. Add another sign-in method before disconnecting.`
      )
      return
    }
    Alert.alert(`Disconnect ${providerLabel(provider)}`, `Are you sure you want to remove ${providerLabel(provider)} sign-in?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => { void disconnect(identity, provider) },
      },
    ])
  }

  function renderAction(provider: OAuthProvider, identity: AuthIdentity | undefined) {
    const pending = pendingProvider === provider
    if (pending || providerState[provider] === 'connecting') {
      return <ActivityIndicator size="small" color={colors.text3} />
    }
    // Reconnect: identity must exist (was previously linked) AND state is revoked.
    // If identity is undefined (never linked or intentionally disconnected) → show Connect, not Reconnect.
    if (identity && providerState[provider] === 'revoked') {
      return (
        <TouchableOpacity
          onPress={() => { void handleReconnect(provider) }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Reconnect ${providerLabel(provider)}`}
          disabled={pendingProvider !== null}
        >
          <Text style={styles.actionConnect}>Reconnect</Text>
        </TouchableOpacity>
      )
    }
    if (identity) {
      return (
        <TouchableOpacity
          onPress={() => { void handleDisconnect(identity, provider) }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Disconnect ${providerLabel(provider)}`}
          disabled={pendingProvider !== null}
        >
          <Text style={styles.actionDisconnect}>Disconnect</Text>
        </TouchableOpacity>
      )
    }
    if (provider === 'apple' && !appleAvailable) {
      return <Text style={styles.unavailableText}>Unavailable</Text>
    }
    return (
      <TouchableOpacity
        onPress={() => { void handleConnect(provider) }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Connect ${providerLabel(provider)}`}
        disabled={pendingProvider !== null}
      >
        <Text style={styles.actionConnect}>Connect</Text>
      </TouchableOpacity>
    )
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
        <Text style={styles.sectionHeader}>SIGN-IN METHODS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.emailIcon}>
              <Text style={styles.emailIconText}>@</Text>
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowSublabel}>
                {identityEmail(emailIdentity) ?? user?.email ?? (emailIdentity ? 'Connected' : 'Not connected')}
              </Text>
            </View>
            <Text style={emailIdentity ? styles.connectedText : styles.unavailableText}>
              {emailIdentity ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          <View style={styles.divider} />
          {showApple ? (
            <>
              <View style={styles.row}>
                <View style={styles.appleIcon}>
                  <Text style={styles.appleIconText}>A</Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Apple</Text>
                  {appleIdentity && providerState['apple'] === 'revoked' ? (
                    <Text style={styles.rowSublabelWarning}>Disconnected outside Rekkus</Text>
                  ) : appleIdentity ? (
                    <Text style={styles.rowSublabel}>{identityEmail(appleIdentity) ?? 'Connected'}</Text>
                  ) : Platform.OS === 'ios' ? (
                    <Text style={styles.rowSublabel}>Use Sign in with Apple</Text>
                  ) : null}
                </View>
                {renderAction('apple', appleIdentity)}
              </View>
              <View style={styles.divider} />
            </>
          ) : null}
          <View style={styles.row}>
            <GoogleIcon />
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Google</Text>
              {googleIdentity && providerState['google'] === 'revoked' ? (
                <Text style={styles.rowSublabelWarning}>Disconnected outside Rekkus</Text>
              ) : googleIdentity ? (
                <Text style={styles.rowSublabel}>{identityEmail(googleIdentity) ?? 'Connected'}</Text>
              ) : null}
            </View>
            {renderAction('google', googleIdentity)}
          </View>
        </View>

        <Text style={styles.hint}>
          Connected accounts let you sign in to Rekkus without a password.
        </Text>
      </View>
    </SafeAreaView>
  )
}

function providerLabel(provider: AuthProviderName): string {
  if (provider === 'email') return 'Email'
  if (provider === 'apple') return 'Apple'
  return 'Google'
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
    divider: { height: spacing.hairline, backgroundColor: c.border, marginLeft: spacing.px50 },
    emailIcon: {
      width: spacing.px18,
      height: spacing.px18,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    emailIconText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text2 },
    appleIcon: {
      width: spacing.px18,
      height: spacing.px18,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    appleIconText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.bg },
    rowMeta: { flex: 1 },
    rowLabel: { fontSize: fontSize.md, color: c.text },
    rowSublabel: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px2 },
    rowSublabelWarning: { fontSize: fontSize.bodySm, color: c.liked, marginTop: spacing.px2 },
    actionConnect: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.info },
    actionDisconnect: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.liked },
    connectedText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text3 },
    unavailableText: { fontSize: fontSize.base, color: c.text3 },
    hint: {
      fontSize: fontSize.bodySm,
      color: c.text3,
      marginHorizontal: spacing[4],
      marginTop: spacing.px10,
      lineHeight: lineHeight.compact,
    },
  })
}
