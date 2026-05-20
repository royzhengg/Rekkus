# Error Handling

Error handling owns how app, service, provider, and Edge Function failures are surfaced.

## Principles

- User copy should be calm, specific, and recoverable.
- Service errors should be observable without leaking secrets or raw provider payloads.
- Provider failures should degrade to cached/local data where possible.
- Critical writes should return clear failure states and avoid duplicate side effects.

## Patterns

| Layer | Pattern |
| --- | --- |
| UI | Show actionable retry or fallback copy. |
| Hooks | Track loading, error, empty, and refresh states explicitly. |
| Services | Normalize errors and avoid provider-specific leakage to screens. |
| Edge Functions | Return safe status/messages and log operational context only. |
| Analytics | Track categorical failure reasons, not raw error bodies. |

## Release Rule

New failure-prone flows should update release smoke tests in [../../operations/RELEASE.md](../../operations/RELEASE.md).

