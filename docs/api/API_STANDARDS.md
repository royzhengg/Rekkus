# API Standards

API standards own service and API boundaries for app, Supabase, Edge Functions, and providers.

## Boundaries

- Screens call hooks or services, not raw provider APIs.
- Supabase calls live behind `lib/services/` unless the task is creating a new service boundary.
- Google Places calls live in [../../lib/services/googlePlaces.ts](../../lib/services/googlePlaces.ts).
- Edge Functions own service-role secrets and server-only provider work.
- Public `EXPO_PUBLIC_*` config must never contain private secrets.

## Request Rules

- Prefer typed inputs and outputs.
- Keep provider payload normalization inside services.
- Use canonical UUIDs for internal entities.
- Make writes authenticated in app code and rely on RLS for authorization.
- Add idempotency for background jobs, retries, and enrichment flows.

## Documentation Triggers

Update this doc and [../architecture/API_GOVERNANCE.md](../architecture/API_GOVERNANCE.md) when adding a new API boundary, provider, Edge Function, or service contract.

