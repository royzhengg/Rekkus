import type { User } from '@supabase/supabase-js'

export type AuthProvider = 'email' | 'google' | 'apple'
export type OAuthProvider = Exclude<AuthProvider, 'email'>

// Add new OAuth providers here only.
// ProviderStateRecord, reconciliation, validation, persistence, and analytics
// automatically inherit support — no other files need updating.
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['apple', 'google']

const PROVIDER_ORDER: AuthProvider[] = ['email', 'apple', 'google']

export function deriveLinkedAuthProviders(user: User | null): AuthProvider[] {
  if (!user) return []
  const providers = new Set<AuthProvider>()
  for (const identity of user.identities ?? []) {
    if (identity.provider === 'email' || identity.provider === 'google' || identity.provider === 'apple') {
      providers.add(identity.provider)
    }
  }
  return PROVIDER_ORDER.filter(provider => providers.has(provider))
}

export function formatLinkedAuthProviders(user: User | null): string {
  const providers = deriveLinkedAuthProviders(user)
  if (providers.length === 0) return 'None'
  const labels: Record<AuthProvider, string> = {
    email: 'Email',
    apple: 'Apple',
    google: 'Google',
  }
  return providers.map(provider => labels[provider]).join(', ')
}
