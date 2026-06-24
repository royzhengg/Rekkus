# lib/services/auth/

```
providerState.ts   — pure business logic (no React, Supabase, or context imports)
providerStorage.ts — versioned AsyncStorage persistence
../auth.ts         — Supabase integration (service boundary)
```

AuthContext = orchestration only. All provider-state decisions live in `providerState.ts`.

## Source-of-truth hierarchy

1. **Supabase identities** (canonical) — `user.identities` from `getUser()`
2. **ProviderStateRecord** (derived advisory state — tracks revocation, not linkage)
3. **AsyncStorage cache** (last-known between sessions, key `auth:provider_state:v1`)
4. **UI** (renders from 2; determines linkage from 1)

Fresh network state always overrides cache. Cache is a render-fast bootstrap, not authoritative.

## Ownership rules

- `ProviderStateRecord` tracks revocation status, **not** whether a provider is linked
- Linkage is determined from `user.identities` — `'connected'` state means "no revocation known"
- **Never** use `ProviderStateRecord` to gate auth, permissions, or content access
- **Never** infer provider linkage from `ProviderConnectionState` — use `user.identities`
- **Never** call Supabase from UI components
- **Never** compare identities in UI components
- **Never** persist provider state outside `providerStorage.ts`
- **Never** persist `'connecting'` state (it is transient; killed-during-reconnect becomes `'revoked'`)

## Glossary

| Term | Meaning |
|------|---------|
| linked | provider identity exists in `user.identities` |
| connected | no revocation known (`ProviderConnectionState === 'connected'`; does NOT imply linked) |
| revoked | provider was previously linked; identity disappeared from `getUser()` response |
| reconnect | re-link a revoked provider via OAuth |
| disconnected | user intentionally unlinked a provider; distinct from revoked |

## Adding a new OAuth provider

Add it to `OAUTH_PROVIDERS` in `lib/utils/authProviders.ts` only.
`ProviderStateRecord`, reconciliation, validation, persistence, and analytics automatically inherit support.
