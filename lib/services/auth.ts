import { supabase } from '@/lib/supabase'
import type { Session, User, UserIdentity } from '@supabase/supabase-js'

export type AuthSession = Session
export type AuthUser = User
export type AuthIdentity = UserIdentity

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

export async function reauthenticate(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error?.message ?? null
}

export async function signUpWithEmail(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signUp({ email, password })
  return error?.message ?? null
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function updateEmail(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw error
}

export async function restoreSession(accessToken: string, refreshToken: string) {
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) throw error
}

export async function restoreSessionForOAuth(accessToken: string, refreshToken: string): Promise<string | null> {
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  return error?.message ?? null
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<AuthSession | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function subscribeToAuthStateChange(onSessionChanged: (session: AuthSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onSessionChanged(session)
  })
  return () => data.subscription.unsubscribe()
}

export async function beginGoogleSignIn(redirectTo: string): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  return { url: data.url ?? null, error: error?.message ?? null }
}

export async function resetPasswordForEmail(email: string, redirectTo: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  return error?.message ?? null
}

export async function beginGoogleLink(redirectTo: string): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo },
  })
  return { url: data.url ?? null, error: error?.message ?? null }
}

export async function unlinkIdentity(identity: AuthIdentity): Promise<string | null> {
  const { error } = await supabase.auth.unlinkIdentity(identity)
  return error?.message ?? null
}

export async function recordAuthAuditEvent(
  eventType: 'login_email_success' | 'login_oauth_success' | 'logout' | 'password_changed' | 'account_deleted',
  context?: Record<string, string> | null
): Promise<void> {
  await supabase.rpc('record_auth_audit_event', {
    p_event_type: eventType,
    p_context: context ?? null,
  })
}
