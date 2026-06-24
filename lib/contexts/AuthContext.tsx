import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { analytics } from '@/lib/analytics'
import {
  beginOAuthLink,
  beginOAuthSignIn,
  getCurrentUser,
  getSession,
  linkIdentityWithIdToken,
  recordAuthAuditEvent,
  refreshCurrentUserIdentities,
  resetPasswordForEmail as requestPasswordReset,
  restoreSessionForOAuth,
  signInWithIdToken as signInToProviderWithIdToken,
  signInWithEmail as authenticateWithEmail,
  signOut as endSession,
  signUpWithEmail as createEmailAccount,
  subscribeToAuthStateChange,
  deleteAccount as removeAccount,
  unlinkIdentity as removeIdentity,
  type AuthAuditContext,
  type AuthIdentity,
  type AuthSession,
  type AuthUser,
} from '@/lib/services/auth'
import {
  buildInitialProviderState,
  classifyReconnectError,
  getNewlyRevokedProviders,
  reconcileProviderState,
  type ProviderStateRecord,
} from '@/lib/services/auth/providerState'
import {
  clearPersistedProviderState,
  loadPersistedProviderState,
  persistProviderState,
} from '@/lib/services/auth/providerStorage'
import { fetchProfile, updateProfile as persistProfile } from '@/lib/services/users'
import { deriveLinkedAuthProviders, type AuthProvider as AuthProviderName, type OAuthProvider } from '@/lib/utils/authProviders'
import { checkCooldown, isCoolingDown, setCooldown } from '@/lib/utils/cooldown'

WebBrowser.maybeCompleteAuthSession()

function getDeviceContext(): Pick<AuthAuditContext, 'device_os' | 'device_version'> {
  const os = Platform.OS
  const device_os = os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'unknown'
  return { device_os, device_version: String(Platform.Version) }
}

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  pendingAppleFullName: string | null
  providerState: ProviderStateRecord
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string) => Promise<string | null>
  updateProfile: (username: string, displayName: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signInWithProvider: (provider: OAuthProvider) => Promise<string | null>
  resetPasswordForEmail: (email: string) => Promise<string | null>
  linkGoogle: () => Promise<string | null>
  linkIdentity: (provider: OAuthProvider) => Promise<string | null>
  unlinkIdentity: (identity: AuthIdentity) => Promise<string | null>
  reconnectProvider: (provider: OAuthProvider) => Promise<string | null>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<string | null>
}

const EMPTY_PROVIDER_STATE = buildInitialProviderState([])

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  pendingAppleFullName: null,
  providerState: EMPTY_PROVIDER_STATE,
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  updateProfile: async () => null,
  signInWithGoogle: async () => null,
  signInWithProvider: async () => null,
  resetPasswordForEmail: async () => null,
  linkGoogle: async () => null,
  linkIdentity: async () => null,
  unlinkIdentity: async () => null,
  reconnectProvider: async () => null,
  signOut: async () => {},
  deleteAccount: async () => null,
})

const APPLE_NONCE_LENGTH_BYTES = 32
const NONCE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._'
const REFRESH_THROTTLE_MS = 5 * 60 * 1000

type AppleAuthOutcome =
  | { type: 'success'; token: string; nonce: string; fullName: string | null }
  | { type: 'cancelled' }
  | { type: 'error'; message: string; reason: 'missing_token' | 'provider_error' | 'unknown' }

function createSecureNonce(): string {
  const bytes = Crypto.getRandomBytes(APPLE_NONCE_LENGTH_BYTES)
  return Array.from(bytes, byte => NONCE_ALPHABET[byte % NONCE_ALPHABET.length]).join('')
}

function getAppleErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function formatAppleFullName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!fullName) return null
  const parts = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].map(part => part?.trim()).filter((part): part is string => !!part)
  return parts.length > 0 ? parts.join(' ') : null
}

function isAuthProvider(provider: string): provider is AuthProviderName {
  return provider === 'email' || provider === 'google' || provider === 'apple'
}

function loginStepForProvider(provider: OAuthProvider): 'login_google' | 'login_apple' {
  return provider === 'google' ? 'login_google' : 'login_apple'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAppleFullName, setPendingAppleFullName] = useState<string | null>(null)
  const [providerState, setProviderState] = useState<ProviderStateRecord>(() => buildInitialProviderState([]))

  // Refs track current state so event callbacks read current values without stale closure.
  const userRef = useRef<AuthUser | null>(null)
  const providerStateRef = useRef<ProviderStateRecord>(buildInitialProviderState([]))
  const lastRefreshRef = useRef<number>(0)
  const refreshInFlightRef = useRef<boolean>(false)
  const mountedRef = useRef(true)

  // Keep refs in sync with state so AppState/auth callbacks always read current values.
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { providerStateRef.current = providerState }, [providerState])

  useEffect(() => {
    mountedRef.current = true

    // Load cached provider state for instant UI, then refresh from network after session loads.
    void loadPersistedProviderState().then(cached => {
      if (!mountedRef.current || !cached) return
      setProviderState(cached)
      providerStateRef.current = cached
    })

    void getSession().then(nextSession => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
      void refreshProviderState(true)
    })

    const unsubscribe = subscribeToAuthStateChange(newSession => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshProviderState()
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
      appStateSub.remove()
    }
  }, [])

  async function refreshProviderState(force = false): Promise<void> {
    if (refreshInFlightRef.current) return
    if (!force && Date.now() - lastRefreshRef.current < REFRESH_THROTTLE_MS) return
    refreshInFlightRef.current = true
    try {
      const fresh = await refreshCurrentUserIdentities()
      if (!mountedRef.current) return
      const userId = userRef.current?.id ?? null
      const previous = providerStateRef.current
      const next = reconcileProviderState(fresh, previous)
      const newlyRevoked = getNewlyRevokedProviders(previous, next)
      setProviderState(next)               // pure setter — no side effects
      providerStateRef.current = next
      void persistProviderState(next)
      for (const p of newlyRevoked) analytics.providerRevoked(userId, p)
      lastRefreshRef.current = Date.now()
    } finally {
      refreshInFlightRef.current = false
    }
  }

  async function reconnectProvider(provider: OAuthProvider): Promise<string | null> {
    setProviderState(prev => {
      const next = { ...prev, [provider]: 'connecting' as const }
      providerStateRef.current = next  // sync ref immediately to avoid stale read if AppState fires before useEffect
      return next
    })
    const userId = user?.id ?? null    // capture before await
    const err = await linkIdentity(provider)
    if (!mountedRef.current) return null
    if (err) {
      setProviderState(prev => {
        const next = { ...prev, [provider]: 'revoked' as const }
        providerStateRef.current = next
        return next
      })
      analytics.providerReconnectFailed(userId, provider, classifyReconnectError(err))
      return err
    }
    setProviderState(prev => {
      const next = { ...prev, [provider]: 'connected' as const }
      providerStateRef.current = next
      void persistProviderState(next)
      return next
    })
    analytics.providerReconnected(userId, provider)
    return null
  }

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const cooldownKey = `loginFailed:${email.toLowerCase()}`
    if (checkCooldown(cooldownKey, 10_000)) {
      analytics.onboardingAnomaly(null, 'login_email', 'cooldown')
      return 'Too many attempts. Please wait before trying again.'
    }
    const error = await authenticateWithEmail(email, password)
    if (error) {
      analytics.onboardingAnomaly(null, 'login_email', 'provider_error')
      setCooldown(cooldownKey)
    } else {
      analytics.onboardingStep(null, 'login_email', 'success')
      void recordAuthAuditEvent('login_email_success', { provider: 'email', ...getDeviceContext() })
    }
    return error
  }

  async function signUpWithEmail(email: string, password: string): Promise<string | null> {
    if (isCoolingDown(`signup:${email.toLowerCase()}`, 30_000)) {
      analytics.onboardingAnomaly(null, 'signup_email', 'cooldown')
      return 'Please wait a moment before trying again.'
    }
    const error = await createEmailAccount(email, password)
    if (error) {
      analytics.onboardingAnomaly(null, 'signup_email', 'provider_error')
    } else {
      analytics.onboardingStep(null, 'signup_email', 'success')
    }
    return error
  }

  async function updateProfile(username: string, displayName: string): Promise<string | null> {
    if (!user) return 'Not signed in'
    try {
      await persistProfile(user.id, {
        username: username.toLowerCase().replace(/\s/g, ''),
        full_name: displayName,
      })
      if (pendingAppleFullName && displayName.trim().length > 0) setPendingAppleFullName(null)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update profile'
    }
  }

  async function runAppleNativeAuth(): Promise<AppleAuthOutcome> {
    if (Platform.OS !== 'ios') {
      return { type: 'error', message: 'Apple Sign-In is only available on iOS.', reason: 'provider_error' }
    }
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      return { type: 'error', message: 'Apple Sign-In is not available on this device.', reason: 'provider_error' }
    }

    const nonce = createSecureNonce()
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
    try {
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!credential.identityToken) {
        return { type: 'error', message: 'Apple did not return an identity token.', reason: 'missing_token' }
      }
      return {
        type: 'success',
        token: credential.identityToken,
        nonce,
        fullName: formatAppleFullName(credential.fullName),
      }
    } catch (error) {
      if (getAppleErrorCode(error) === 'ERR_REQUEST_CANCELED') return { type: 'cancelled' }
      return {
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not sign in with Apple.',
        reason: 'provider_error',
      }
    }
  }

  async function refreshCurrentUser(): Promise<AuthUser | null> {
    const updated = await getCurrentUser()
    if (updated) setUser(updated)
    return updated
  }

  async function persistAppleFullNameIfEmpty(userId: string, fullName: string | null): Promise<void> {
    if (!fullName) return
    try {
      const profile = await fetchProfile(userId)
      if (profile?.full_name?.trim()) {
        setPendingAppleFullName(null)
        return
      }
      await persistProfile(userId, { full_name: fullName })
      setPendingAppleFullName(null)
    } catch {
      setPendingAppleFullName(fullName)
      analytics.onboardingAnomaly(userId, 'login_apple', 'profile_name_persist_failed')
    }
  }

  async function signInWithOAuthProvider(provider: OAuthProvider): Promise<string | null> {
    const redirectTo = Linking.createURL('/auth/callback')
    const onboardingStep = loginStepForProvider(provider)
    analytics.loginOAuthStarted(null, provider)
    const { url, error } = await beginOAuthSignIn(provider, redirectTo)
    if (error) {
      analytics.loginOAuthFailed(null, provider, 'provider_error')
      analytics.onboardingAnomaly(null, onboardingStep, 'provider_error')
      return error
    }
    if (!url) {
      analytics.loginOAuthFailed(null, provider, 'provider_error')
      analytics.onboardingAnomaly(null, onboardingStep, 'missing_oauth_url')
      return 'No OAuth URL returned'
    }

    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo)
    if (result.type !== 'success') {
      analytics.loginOAuthFailed(null, provider, 'cancelled')
      analytics.onboardingAnomaly(null, onboardingStep, 'oauth_cancelled_or_failed')
      return null
    }

    const callbackUrl = result.url
    const params = new URLSearchParams(
      callbackUrl.includes('#') ? callbackUrl.split('#')[1] : (callbackUrl.split('?')[1] ?? '')
    )
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      const sessionError = await restoreSessionForOAuth(accessToken, refreshToken)
      if (sessionError) {
        analytics.loginOAuthFailed(null, provider, 'session_error')
        analytics.onboardingAnomaly(null, onboardingStep, 'session_error')
      } else {
        analytics.loginOAuthSuccess(null, provider)
        analytics.onboardingStep(null, onboardingStep, 'success')
        void recordAuthAuditEvent('login_oauth_success', { provider, ...getDeviceContext() })
      }
      return sessionError
    }
    analytics.loginOAuthFailed(null, provider, 'missing_token')
    analytics.onboardingAnomaly(null, onboardingStep, 'missing_session_credentials')
    return null
  }

  async function signInWithProvider(provider: OAuthProvider): Promise<string | null> {
    if (provider === 'google') return signInWithOAuthProvider(provider)

    analytics.loginOAuthStarted(null, provider)
    const outcome = await runAppleNativeAuth()
    if (outcome.type === 'cancelled') {
      analytics.loginOAuthFailed(null, provider, 'cancelled')
      return null
    }
    if (outcome.type === 'error') {
      analytics.loginOAuthFailed(null, provider, outcome.reason)
      analytics.onboardingAnomaly(null, 'login_apple', outcome.reason)
      return outcome.message
    }

    const error = await signInToProviderWithIdToken(provider, outcome.token, outcome.nonce)
    if (error) {
      analytics.loginOAuthFailed(null, provider, 'session_error')
      analytics.onboardingAnomaly(null, 'login_apple', 'session_error')
      return error
    }

    const updated = await refreshCurrentUser()
    if (updated) await persistAppleFullNameIfEmpty(updated.id, outcome.fullName)
    analytics.loginOAuthSuccess(updated?.id ?? null, provider)
    analytics.onboardingStep(updated?.id ?? null, 'login_apple', 'success')
    void recordAuthAuditEvent('login_oauth_success', { provider, ...getDeviceContext() })
    return null
  }

  async function signInWithGoogle(): Promise<string | null> {
    return signInWithProvider('google')
  }

  async function resetPasswordForEmail(email: string): Promise<string | null> {
    if (isCoolingDown(`password-reset:${email.toLowerCase()}`, 60_000)) {
      analytics.onboardingAnomaly(null, 'password_reset', 'cooldown')
      return 'Please wait a moment before requesting another reset link.'
    }
    const redirectTo = Linking.createURL('/')
    const error = await requestPasswordReset(email, redirectTo)
    if (error) {
      analytics.onboardingAnomaly(null, 'password_reset', 'provider_error')
    } else {
      analytics.onboardingStep(null, 'password_reset', 'sent')
    }
    return error
  }

  async function linkGoogle(): Promise<string | null> {
    return linkIdentity('google')
  }

  async function linkIdentity(provider: OAuthProvider): Promise<string | null> {
    const redirectTo = Linking.createURL('/')
    if (provider === 'google') {
      const { url, error } = await beginOAuthLink(provider, redirectTo)
      if (error) return error
      if (!url) return 'No OAuth URL returned'
      const result = await WebBrowser.openAuthSessionAsync(url, redirectTo)
      if (result.type !== 'success') return null
    } else {
      const outcome = await runAppleNativeAuth()
      if (outcome.type === 'cancelled') return null
      if (outcome.type === 'error') return outcome.message
      const error = await linkIdentityWithIdToken(provider, outcome.token, outcome.nonce)
      if (error) return error
      const linkedUser = await getCurrentUser()
      if (linkedUser) await persistAppleFullNameIfEmpty(linkedUser.id, outcome.fullName)
    }
    const updated = await refreshCurrentUser()
    analytics.accountLinked(updated?.id ?? user?.id ?? null, provider)
    // Explicitly mark connected so re-linking after intentional disconnect doesn't show Reconnect.
    setProviderState(prev => {
      const next = { ...prev, [provider]: 'connected' as const }
      providerStateRef.current = next
      return next
    })
    return null
  }

  async function unlinkIdentity(identity: AuthIdentity): Promise<string | null> {
    const remainingProviders = deriveLinkedAuthProviders(user).filter(provider => provider !== identity.provider)
    if (remainingProviders.length === 0) return 'Add another sign-in method before disconnecting this one.'
    const error = await removeIdentity(identity)
    if (error) return error
    const updated = await refreshCurrentUser()
    const provider = identity.provider
    if (isAuthProvider(provider)) {
      analytics.accountUnlinked(updated?.id ?? user?.id ?? null, provider)
    }
    return null
  }

  async function signOut() {
    mountedRef.current = false
    const empty = buildInitialProviderState([])
    providerStateRef.current = empty   // reset ref immediately so any in-flight refresh reads clean state
    setProviderState(empty)
    void clearPersistedProviderState()
    void recordAuthAuditEvent('logout')
    await endSession()
  }

  async function deleteAccount(): Promise<string | null> {
    // Client-side belt-and-suspenders; primary guarantee is auth_audit_delete_trigger (B-519).
    mountedRef.current = false
    const empty = buildInitialProviderState([])
    providerStateRef.current = empty
    setProviderState(empty)
    void clearPersistedProviderState()
    void recordAuthAuditEvent('account_deleted', getDeviceContext())
    const error = await removeAccount()
    if (!error) {
      setUser(null)
      setSession(null)
    }
    return error
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        pendingAppleFullName,
        providerState,
        signInWithEmail,
        signUpWithEmail,
        updateProfile,
        signInWithGoogle,
        signInWithProvider,
        resetPasswordForEmail,
        linkGoogle,
        linkIdentity,
        unlinkIdentity,
        reconnectProvider,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Re-export for consumers that need these types.
export type { ProviderStateRecord } from '@/lib/services/auth/providerState'
export { OAUTH_PROVIDERS } from '@/lib/utils/authProviders'
