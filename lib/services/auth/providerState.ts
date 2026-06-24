import { OAUTH_PROVIDERS, type OAuthProvider } from '@/lib/utils/authProviders'
import type { UserIdentity } from '@supabase/supabase-js'

// ReconnectFailureReason lives here (domain logic, not React orchestration).
export type ReconnectFailureReason = 'cancelled' | 'oauth_failure' | 'network' | 'unknown'

export type ProviderConnectionState = 'connected' | 'revoked' | 'connecting'
// Semantics:
//   'connected'  = no known revocation (does NOT imply the provider is linked — linkage comes from user.identities)
//   'revoked'    = identity was present, now absent from getUser() response
//   'connecting' = reconnect in progress (transient, never persisted)
//
// State transition table:
//   connected  + identity absent in fresh  → revoked
//   revoked    + identity present in fresh → connected   (self-healing)
//   revoked    + reconnect success         → connected
//   revoked    + reconnect failure         → revoked
//   connecting + fresh identity present    → connected   (must not stay stuck)
//   connecting + reconnect success         → connected
//   connecting + reconnect failure         → revoked
//   any        + fresh = null (network)    → unchanged

export type ProviderStateRecord = Record<OAuthProvider, ProviderConnectionState>

// Build initial record. All providers start as 'connected' (no known revocation).
// NOTE: 'connected' here means "no revocation detected", NOT "the provider is linked".
// Linkage is always determined separately via user.identities.
export function buildInitialProviderState(_identities: UserIdentity[]): ProviderStateRecord {
  return Object.fromEntries(
    OAUTH_PROVIDERS.map(p => [p, 'connected' as const])
  ) as ProviderStateRecord
}

// Merges fresh identity list with existing state.
// null fresh = network failure — return existing unchanged (conservative default).
// Self-healing: provider present in fresh that was 'revoked' or 'connecting' → 'connected'.
// Provider absent from fresh that was 'connected' → 'revoked'.
// 'connecting' + identity absent → 'revoked' (reconnect either failed or app was killed mid-flow).
// Unknown/future providers filtered through OAUTH_PROVIDERS — ignored.
export function reconcileProviderState(
  fresh: UserIdentity[] | null,
  existing: ProviderStateRecord,
): ProviderStateRecord {
  if (fresh === null) return existing

  const freshProviderSet = new Set<OAuthProvider>()
  for (const identity of fresh) {
    if ((OAUTH_PROVIDERS as readonly string[]).includes(identity.provider)) {
      freshProviderSet.add(identity.provider as OAuthProvider)
    }
  }

  return Object.fromEntries(
    OAUTH_PROVIDERS.map(p => {
      const current = existing[p]
      const presentInFresh = freshProviderSet.has(p)

      if (presentInFresh) {
        // Identity exists — clear any revoked or stuck-connecting state.
        return [p, 'connected' as const]
      }
      // Identity absent.
      if (current === 'connected') return [p, 'revoked' as const]
      if (current === 'connecting') return [p, 'revoked' as const]
      return [p, current]   // already 'revoked' — stay revoked
    })
  ) as ProviderStateRecord
}

// Returns providers that transitioned to 'revoked' in next but were not 'revoked' in previous.
// Call BEFORE setProviderState to keep state setters side-effect-free.
export function getNewlyRevokedProviders(
  previous: ProviderStateRecord,
  next: ProviderStateRecord,
): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter(p => previous[p] !== 'revoked' && next[p] === 'revoked')
}

// Runtime validation for persisted state.
// Rejects unknown states, unknown providers, and malformed payloads.
export function isValidProviderStateRecord(value: unknown): value is ProviderStateRecord {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  const validStates = new Set<string>(['connected', 'revoked', 'connecting'])
  // Must have exactly the known OAuth provider keys and no extra keys.
  const keys = Object.keys(obj)
  if (keys.length !== OAUTH_PROVIDERS.length) return false
  for (const p of OAUTH_PROVIDERS) {
    if (!validStates.has(obj[p] as string)) return false
  }
  for (const key of keys) {
    if (!(OAUTH_PROVIDERS as readonly string[]).includes(key)) return false
  }
  return true
}

const RECONNECT_ERROR_PATTERNS: Array<[RegExp, ReconnectFailureReason]> = [
  [/cancel/i, 'cancelled'],
  [/network|fetch|timeout|offline/i, 'network'],
  [/oauth|provider|token|invalid/i, 'oauth_failure'],
]

// Maps a raw error string to a bounded enum — prevents analytics cardinality explosion.
export function classifyReconnectError(err: string): ReconnectFailureReason {
  for (const [pattern, reason] of RECONNECT_ERROR_PATTERNS) {
    if (pattern.test(err)) return reason
  }
  return 'unknown'
}
