# Auth Domain

Primary entry point for AI agents exploring the auth area.

## Architecture Overview

Rekkus supports three sign-in methods: email/password, Sign in with Apple (iOS only), and Google OAuth. All identity management is handled by Supabase Auth. The client never stores tokens — all session data lives in Supabase's secure storage.

**Layer responsibilities:**
- `lib/services/auth.ts` — Supabase integration (all `supabase.auth.*` calls)
- `lib/services/auth/providerState.ts` — pure business logic (no React, no Supabase)
- `lib/services/auth/providerStorage.ts` — versioned AsyncStorage persistence
- `lib/contexts/AuthContext.tsx` — orchestration, React state, AppState listener
- `features/settings/ConnectedAccountsScreen.tsx` — rendering only; never compares identities directly

## Glossary

| Term | Meaning |
|------|---------|
| linked | provider identity exists in `user.identities` |
| connected | no revocation known (`ProviderConnectionState === 'connected'`; does NOT imply linked) |
| revoked | provider was previously linked; identity disappeared from `getUser()` response |
| reconnect | re-link a revoked provider via OAuth (same flow as initial link) |
| disconnected | user intentionally unlinked a provider via settings; distinct from revoked |

## Source-of-Truth Hierarchy

1. **Supabase identities** — `user.identities` from `supabase.auth.getUser()` (canonical)
2. **ProviderStateRecord** — derived advisory state tracking revocation (not linkage)
3. **AsyncStorage cache** (`auth:provider_state:v1`) — last-known between sessions
4. **UI** — renders from (2); determines linkage from (1)

Fresh network state always overrides cache. Cache is a render-fast bootstrap, not authoritative.

## Provider Lifecycle

```
Link provider
  → identity appears in user.identities
  → providerState[provider] = 'connected'

Active session
  → user.identities contains the provider
  → providerState[provider] = 'connected'

Revoke externally (user removes Rekkus in Apple/Google settings)
  → on next getUser() call, identity disappears from user.identities
  → providerState[provider] transitions 'connected' → 'revoked'
  → analytics: provider_revoked_detected (transition-based, not repeated)

Reconnect
  → user taps "Reconnect" in Connected Accounts
  → providerState[provider] = 'connecting' (transient)
  → OAuth flow runs (same as initial link)
  → on success: providerState[provider] = 'connected'
  → on failure: providerState[provider] = 'revoked'

Intentional disconnect
  → user taps "Disconnect" in Connected Accounts
  → unlinkIdentity() removes identity from Supabase
  → identity disappears from user.identities
  → next refresh reconciles to 'revoked' — but identity is absent so Reconnect UI is unreachable
  → UI shows "Connect" (normal path)
```

## Revocation Detection

Detection is **advisory and best-effort** — not real-time, not cross-device.

- On app startup: load cache → render → force-refresh identities from `getUser()`
- On foreground (AppState `'active'`): refresh identities (throttled to once per 5 minutes)
- In-flight guard prevents concurrent refreshes

`ProviderStateRecord` is UX advisory state only. It must never gate authentication, authorisation, permissions, or content access.

## UI Invariant

"Reconnect" is shown only when **both** conditions hold:
- `identity !== undefined` (provider was previously linked)
- `providerState[provider] === 'revoked'`

This means intentional disconnect (identity removed) and external revocation (identity absent) cannot be confused at the UI level — the former removes the identity, making the reconnect path unreachable.

## Session Independence

Provider revocation does not invalidate an active Rekkus session. The session remains valid until it expires or the user signs out explicitly. `ProviderStateRecord` communicates that future OAuth authentication with the provider will fail, not that the current session is invalid.

## Adding a New OAuth Provider

Add the provider to `OAUTH_PROVIDERS` in `lib/utils/authProviders.ts` only. `ProviderStateRecord`, `reconcileProviderState`, `isValidProviderStateRecord`, `persistProviderState`, and analytics events all iterate `OAUTH_PROVIDERS` and automatically support the new provider.

## Common Pitfalls

- **Do not infer linkage from `ProviderConnectionState`** — `'connected'` means "no revocation known", not "the provider is linked". Linkage comes from `user.identities`.
- **Do not gate access on `ProviderStateRecord`** — it is UX advisory state only.
- **Do not call Supabase from UI components** — use `lib/services/auth.ts` functions.
- **Do not compare identities in UI components** — comparisons belong in `providerState.ts`.
- **Do not persist `'connecting'` state** — it is transient. If the app is killed during reconnect, the provider returns to `'revoked'` on the next startup and resolves after the next refresh cycle.
