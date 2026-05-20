import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User, UserIdentity } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from '../supabase'
import { isCoolingDown } from '@/lib/utils/cooldown'
import { analytics } from '@/lib/analytics'

WebBrowser.maybeCompleteAuthSession()

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  signUpWithEmail: (email: string, password: string) => Promise<string | null>
  updateProfile: (username: string, displayName: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  resetPasswordForEmail: (email: string) => Promise<string | null>
  linkGoogle: () => Promise<string | null>
  unlinkIdentity: (identity: UserIdentity) => Promise<string | null>
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
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithEmail(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      analytics.onboardingAnomaly(null, 'login_email', 'provider_error')
    } else {
      analytics.onboardingStep(null, 'login_email', 'success')
    }
    return error?.message ?? null
  }

  async function signUpWithEmail(email: string, password: string): Promise<string | null> {
    if (isCoolingDown(`signup:${email.toLowerCase()}`, 30_000)) {
      analytics.onboardingAnomaly(null, 'signup_email', 'cooldown')
      return 'Please wait a moment before trying again.'
    }
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      analytics.onboardingAnomaly(null, 'signup_email', 'provider_error')
    } else {
      analytics.onboardingStep(null, 'signup_email', 'success')
    }
    return error?.message ?? null
  }

  async function updateProfile(username: string, displayName: string): Promise<string | null> {
    if (!user) return 'Not signed in'
    const { error } = await (supabase.from('users') as any).upsert({
      id: user.id,
      username: username.toLowerCase().replace(/\s/g, ''),
      full_name: displayName,
    })
    return error?.message ?? null
  }

  async function signInWithGoogle(): Promise<string | null> {
    const redirectTo = Linking.createURL('/auth/callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      analytics.onboardingAnomaly(null, 'login_google', 'provider_error')
      return error.message
    }
    if (!data.url) {
      analytics.onboardingAnomaly(null, 'login_google', 'missing_oauth_url')
      return 'No OAuth URL returned'
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') {
      analytics.onboardingAnomaly(null, 'login_google', 'oauth_cancelled_or_failed')
      return null
    }

    const url = result.url
    const params = new URLSearchParams(
      url.includes('#') ? url.split('#')[1] : (url.split('?')[1] ?? '')
    )
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (sessionError) {
        analytics.onboardingAnomaly(null, 'login_google', 'session_error')
      } else {
        analytics.onboardingStep(null, 'login_google', 'success')
      }
      return sessionError?.message ?? null
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      analytics.onboardingAnomaly(null, 'password_reset', 'provider_error')
    } else {
      analytics.onboardingStep(null, 'password_reset', 'sent')
    }
    return error?.message ?? null
  }

  async function linkGoogle(): Promise<string | null> {
    const redirectTo = Linking.createURL('/')
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) return error.message
    if (!data.url) return 'No OAuth URL returned'
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') return null
    const { data: { user: updated } } = await supabase.auth.getUser()
    if (updated) setUser(updated)
    return null
  }

  async function unlinkIdentity(identity: UserIdentity): Promise<string | null> {
    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (error) return error.message
    const { data: { user: updated } } = await supabase.auth.getUser()
    if (updated) setUser(updated)
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
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
