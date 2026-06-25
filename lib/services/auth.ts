import { supabase } from '@/lib/supabase'
import type { AuthProvider, OAuthProvider } from '@/lib/utils/authProviders'
import type { Json } from '@/types/database'
import type { Session, User, UserIdentity } from '@supabase/supabase-js'

export type AuthSession = Session
export type AuthUser = User
export type AuthIdentity = UserIdentity
export type { AuthProvider, OAuthProvider } from '@/lib/utils/authProviders'
export { formatLinkedAuthProviders } from '@/lib/utils/authProviders'

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

export async function beginOAuthSignIn(
  provider: OAuthProvider,
  redirectTo: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })
  return { url: data.url ?? null, error: error?.message ?? null }
}

export async function beginGoogleSignIn(redirectTo: string): Promise<{ url: string | null; error: string | null }> {
  return beginOAuthSignIn('google', redirectTo)
}

export async function signInWithIdToken(
  provider: OAuthProvider,
  token: string,
  nonce?: string
): Promise<string | null> {
  // `nonce` is required for Apple ID-token auth; other providers should omit it unless their token contains a nonce claim.
  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token,
    ...(nonce ? { nonce } : {}),
  })
  return error?.message ?? null
}

export async function resetPasswordForEmail(email: string, redirectTo: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  return error?.message ?? null
}

export async function beginOAuthLink(
  provider: OAuthProvider,
  redirectTo: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo },
  })
  return { url: data.url ?? null, error: error?.message ?? null }
}

export async function beginGoogleLink(redirectTo: string): Promise<{ url: string | null; error: string | null }> {
  return beginOAuthLink('google', redirectTo)
}

export async function linkIdentityWithIdToken(
  provider: OAuthProvider,
  token: string,
  nonce?: string
): Promise<string | null> {
  // `nonce` is required for Apple ID-token auth; other providers should omit it unless their token contains a nonce claim.
  const { error } = await supabase.auth.linkIdentity({
    provider,
    token,
    ...(nonce ? { nonce } : {}),
  })
  return error?.message ?? null
}

export async function unlinkIdentity(identity: AuthIdentity): Promise<string | null> {
  const { error } = await supabase.auth.unlinkIdentity(identity)
  return error?.message ?? null
}

export async function deleteAccount(): Promise<string | null> {
  const { error } = await supabase.rpc('delete_own_account')
  return error?.message ?? null
}

// Returns null on network/auth failure — distinguishable from a genuinely empty identity list ([]).
export async function refreshCurrentUserIdentities(): Promise<AuthIdentity[] | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user?.identities ?? []
}

// Typed context for auth audit events (B-520).
// ip_hash is server-side only (auth-audit-hook Edge Function); never send from client.
export interface AuthAuditContext extends Record<string, Json | undefined> {
  provider?: AuthProvider
  device_os?: 'ios' | 'android' | 'web' | 'unknown'
  device_version?: string
}

// MFA audit metadata — never include OTP values, recovery codes, TOTP secrets, or QR SVG.
export interface MFAAuditMetadata {
  factor_id?: string
  remaining_codes_before?: number  // for mfa_recovery_codes_regenerated
  attempt_number?: number          // for mfa_challenge_failed, mfa_recovery_code_failed
  generation_id?: string           // for mfa_recovery_codes_regenerated; links to code batch
}

export type AuthAuditEventType =
  | 'login_email_success'
  | 'login_oauth_success'
  | 'logout'
  | 'password_changed'
  | 'account_deleted'
  | 'mfa_enrolled'
  | 'mfa_enroll_failed'
  | 'mfa_unenrolled'
  | 'mfa_challenge_started'
  | 'mfa_verified'
  | 'mfa_challenge_failed'
  | 'mfa_recovery_code_used'
  | 'mfa_recovery_code_failed'
  | 'mfa_recovery_codes_regenerated'
  | 'mfa_disable_attempted'
  | 'mfa_disable_cancelled'

// Audit events are best-effort — auth must never fail because audit logging failed.
// Callers wrap in try/catch or use this function which swallows errors internally.
export async function recordAuthAuditEvent(
  eventType: AuthAuditEventType,
  context?: (AuthAuditContext & MFAAuditMetadata) | null
): Promise<void> {
  await supabase.rpc('record_auth_audit_event', {
    p_event_type: eventType,
    p_context: context ?? null,
  })
}
