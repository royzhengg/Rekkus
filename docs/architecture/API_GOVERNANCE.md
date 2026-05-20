# API Governance

Owner: Engineering

API governance keeps external calls observable, reversible, and away from screen code.

## Boundaries

- `app/` contains Expo Router wrappers only.
- `features/` may call hooks and services, but must not own provider protocols.
- `lib/services/` owns Supabase, Google, Expo, Resend, and network calls.
- Supabase Edge Functions own service-role secrets and privileged server-side work.
- Provider response mapping should produce app-facing domain types before reaching UI.

## Required Patterns

- Authenticated writes must check local auth state and rely on Supabase RLS for authorization.
- Provider calls should expose clear failure modes and avoid throwing raw provider objects into UI.
- Expensive reads need cache, dedupe, or pagination before launch.
- Retry behavior belongs in services or job runners with max attempts and manual override metadata.

## Guardrails

- `scripts/check-hygiene.js` detects new direct service/API access from `app/` and `features/`.
- `scripts/check-hygiene.js` blocks service-role env usage outside Supabase Edge Functions.
- `scripts/ops/check-operations.js` validates this doc and API guardrail coverage.

## Review Questions

- Is there an existing service or hook that should own this call?
- Does the caller know whether data came from local DB, Google fallback, or a cache?
- Does the caller preserve provider source, retention, attribution, cacheability, and audit metadata?
- Does the provider call go through `lib/services` and remain kill-switchable, rate-limited, and cost-aware?
- Is the failure path product-owned and safe for weak network conditions?
