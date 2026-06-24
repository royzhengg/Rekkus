# ADR-0024: Provider Revocation Detection

**Status:** Accepted  
**Date:** 2026-06-24  
**Author:** B-620

---

## Context

Apple and Google OAuth identities can be revoked externally — the user removes the Rekkus app from their Apple/Google account settings. When this happens, Supabase Auth learns of the revocation on the next `supabase.auth.getUser()` call (the token refresh fails, and the identity disappears from `user.identities`). Prior to B-620, the client had no mechanism to detect this condition, leaving the Connected Accounts UI stale until the next session refresh or sign-in failure exposed the problem.

**Supabase revocation behaviour (spike result — TODO: fill in after validation):**  
_Validate on a real device: revoke Rekkus in Apple/Google settings, then call `supabase.auth.getUser()`. Confirm whether the identity disappears from `user.identities` in the response. If it does not, this entire detection mechanism needs redesigning — that result would mean revocation is only detectable via a failed OAuth flow, not via `getUser()`._

---

## Decision

Implement client-side, best-effort revocation detection using `getUser()` on app startup and on app foreground, with results persisted to AsyncStorage.

**No database table is added.** `ProviderStateRecord` is advisory UX state only — it never gates authentication, authorisation, permissions, or content access.

---

## Implementation Summary

### State model

```ts
type ProviderConnectionState = 'connected' | 'revoked' | 'connecting'
type ProviderStateRecord = Record<OAuthProvider, ProviderConnectionState>
```

`'connected'` means "no revocation known" — it does **not** imply the provider is linked. Linkage is determined from `user.identities`. An email-only user has `{ google: 'connected', apple: 'connected' }` — this is correct; it means no revocation has been detected, not that both providers are linked.

### State transition table

| Current state | Event | Next state |
|--------------|-------|-----------|
| connected | identity absent in fresh `getUser()` | revoked |
| revoked | identity present in fresh `getUser()` | connected (self-healing) |
| revoked | reconnect success | connected |
| revoked | reconnect failure | revoked |
| connecting | fresh identity present | connected (must not stay stuck) |
| connecting | reconnect success | connected |
| connecting | reconnect failure | revoked |
| any | fresh = null (network failure) | unchanged |

### Detection flow

```
App startup
  → load AsyncStorage cache (render immediately)
  → getSession() resolves
  → force-refresh identities via getUser()
  → reconcile against previous state
  → persist updated state
  → update UI

App foreground (AppState 'active')
  → throttled: skip if last refresh < 5 minutes ago
  → in-flight guard: skip if a refresh is already running
  → refresh identities → reconcile → persist → update UI
```

### Persistence

Key: `auth:provider_state:v1`

- `'connecting'` state is never persisted — if the app is killed during reconnect, the provider returns to `'revoked'` on restart. This is intentional: the next refresh cycle will self-heal if the reconnect actually succeeded.
- Corrupted or stale-shaped JSON is discarded and the key is cleared.
- Key versioning: increment the `v1` suffix if `ProviderStateRecord` shape changes. Old keys are abandoned (no migration needed).

**Fresh network state always overrides cache.** Cache is a render-fast bootstrap, not authoritative.

### UI invariant

"Reconnect" is rendered only when **both** conditions hold:
1. `identity !== undefined` (provider is currently linked)
2. `providerState[provider] === 'revoked'`

Intentional disconnect removes the identity from `user.identities`, making condition (1) false — the reconnect path is unreachable. This prevents disconnect and external revocation from being confused at the UI level.

### Analytics

Events are **transition-based, not state-based** — `provider_revoked_detected` fires once per `connected → revoked` transition, never on repeated `revoked → revoked` checks.

Permitted analytics fields: `provider`, `reason` (bounded enum).  
Banned: OAuth tokens, identity payloads, full error strings, user emails.

---

## Non-Goals (Explicit)

This implementation intentionally does **not**:

- Detect revocation in real time (detection is on foreground + startup only)
- Synchronise revocation state across devices (state is local-only; two devices may disagree — acceptable for advisory UX)
- Invalidate active Rekkus sessions (sessions remain valid until expiry or explicit sign-out)
- Enforce any security or access-control decision
- Persist reconnect attempts
- Track how many times a user has attempted reconnect

---

## Consequences

**Positive:**
- No new database table, no new RLS, no new migrations
- No server-side complexity
- Revocation detected within the next foreground event (typically within minutes)
- Self-healing: if the user re-authorises the app externally, state clears automatically
- Adding new OAuth providers requires only adding to `OAUTH_PROVIDERS` constant

**Negative / accepted trade-offs:**
- Multi-device disagreement: device A may show a reconnect prompt that device B does not
- Detection lag: revocation is detected on next foreground, not instantly
- If Supabase does not remove the identity from `getUser()` on revocation (spike TBD), the detection mechanism is ineffective and needs redesign

---

## Source-of-Truth Hierarchy

1. Supabase identities (canonical)
2. ProviderStateRecord (derived advisory state)
3. AsyncStorage cache (last-known between sessions)
4. UI (renders from 2; determines linkage from 1)

---

## Security Boundary

> Provider revocation only affects future OAuth authentication. Existing authenticated Rekkus sessions remain valid until expiry or explicit sign-out. `ProviderStateRecord` is UX advisory state and must never gate authentication, authorisation, permissions, or content access.

---

## Alternatives Considered

**Server-side revocation webhook** — Apple and Google do not offer a reliable real-time revocation push to app servers. Polling would be expensive and complex. Rejected.

**Database table for provider state** — would introduce RLS surface, sync complexity, and migration burden for what is purely advisory UX state. Rejected.

**SecureStore instead of AsyncStorage** — provider state is non-sensitive derived data (it reflects what Supabase already knows). SecureStore is appropriate for credentials; AsyncStorage is appropriate here. Rejected.
