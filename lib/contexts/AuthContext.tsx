import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'
import {
  beginGoogleLink,
  beginGoogleSignIn,
  getCurrentUser,
  getSession,
  recordAuthAuditEvent,
  resetPasswordForEmail as requestPasswordReset,
  restoreSessionForOAuth,
  signInWithEmail as authenticateWithEmail,
  signOut as endSession,
  signUpWithEmail as createEmailAccount,
  subscribeToAuthStateChange,
  unlinkIdentity as removeIdentity,
  type AuthIdentity,
  type AuthSession,
  type AuthUser,
} from '@/lib/services/auth'
import { updateProfile as persistProfile } from '@/lib/services/users'
import { checkCooldown, isCoolingDown, setCooldown } from '@/lib/utils/cooldown'

WebBrowser.maybeCompleteAuthSession()

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string) => Promise<string | null>
  updateProfile: (username: string, displayName: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  resetPasswordForEmail: (email: string) => Promise<string | null>
  linkGoogle: () => Promise<string | null>
  unlinkIdentity: (identity: AuthIdentity) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signInWithEmail: async () => null,
  signUpWithEmail: async () => null,
  updateProfile: async () => null,
  signInWithGoogle: async () => null,
  resetPasswordForEmail: async () => null,
  linkGoogle: async () => null,
  unlinkIdentity: async () => null,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getSession().then(nextSession => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    const unsubscribe = subscribeToAuthStateChange(newSession => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return unsubscribe
  }, [])

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
      void recordAuthAuditEvent('login_email_success', { provider: 'email' })
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
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update profile'
    }
  }

  async function signInWithGoogle(): Promise<string | null> {
    const redirectTo = Linking.createURL('/auth/callback')
    const { url, error } = await beginGoogleSignIn(redirectTo)
    if (error) {
      analytics.onboardingAnomaly(null, 'login_google', 'provider_error')
      return error
    }
    if (!url) {
      analytics.onboardingAnomaly(null, 'login_google', 'missing_oauth_url')
      return 'No OAuth URL returned'
    }

    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo)
    if (result.type !== 'success') {
      analytics.onboardingAnomaly(null, 'login_google', 'oauth_cancelled_or_failed')
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
        analytics.onboardingAnomaly(null, 'login_google', 'session_error')
      } else {
        analytics.onboardingStep(null, 'login_google', 'success')
        void recordAuthAuditEvent('login_oauth_success', { provider: 'google' })
      }
      return sessionError
    }
    analytics.onboardingAnomaly(null, 'login_google', 'missing_session_credentials')
    return null
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
    const redirectTo = Linking.createURL('/')
    const { url, error } = await beginGoogleLink(redirectTo)
    if (error) return error
    if (!url) return 'No OAuth URL returned'
    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo)
    if (result.type !== 'success') return null
    const updated = await getCurrentUser()
    if (updated) setUser(updated)
    return null
  }

  async function unlinkIdentity(identity: AuthIdentity): Promise<string | null> {
    const error = await removeIdentity(identity)
    if (error) return error
    const updated = await getCurrentUser()
    if (updated) setUser(updated)
    return null
  }

  async function signOut() {
    void recordAuthAuditEvent('logout')
    await endSession()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithEmail,
        signUpWithEmail,
        updateProfile,
        signInWithGoogle,
        resetPasswordForEmail,
        linkGoogle,
        unlinkIdentity,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
