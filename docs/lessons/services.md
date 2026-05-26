# Lessons: Services Layer

## Supabase calls belong in `lib/services/`, not in app-facing orchestration

Screens, hooks, and contexts that query Supabase directly cannot be tested, reused, or mocked consistently. All database, auth, and provider operations go in typed service functions:

```ts
// lib/services/posts.ts
export async function likePost(postId: string, userId: string): Promise<void> { ... }

// screen
import { likePost } from '@/lib/services/posts'
```

Do not import provider-owned types into hooks or contexts as a shortcut. Services expose stable application-facing aliases and subscriptions; `check:architecture` and ESLint reject direct Supabase/provider imports across `app/`, `features/`, `lib/hooks/`, and `lib/contexts/`.

## Never bridge missing Supabase types with `any`

The Supabase client is typed as `createClient<Database>()`. Any `as any` cast on `.from()` is unnecessary for tables that exist in `types/database.ts`. If schema types are stale, regenerate them before adding callers. If an external payload still needs interpretation, accept `unknown` in a service wrapper and narrow it with guards.

```ts
// WRONG — schema drift is hidden from every caller
(supabase.from('trending_searches') as any).select('query')

// RIGHT — generated Database types define the query surface
// lib/services/search.ts
export async function fetchTrendingSearches(limit: number): Promise<TrendingSearchRow[]> {
  const { data, error } = await supabase.from('trending_searches').select('query').limit(limit)
  if (error) throw error
  return data
}
```

The unsafe typing scanner and ESLint rules cover runtime boundaries, so casts and suppression comments fail CI immediately.

## Retire superseded RPC overloads when return shapes change

`CREATE OR REPLACE FUNCTION` only replaces the identical PostgreSQL signature. Adding parameters creates a new overload and leaves older signatures callable; PostgREST and generated TypeScript may then bind to a legacy return shape. When an RPC's canonical result expands, explicitly drop obsolete overloads in the migration and regenerate `types/database.ts`.

## Server-side auth audit uses a trigger, not an Edge Function

For auth events that must be ISO A.12.4.1-compliant, a PostgreSQL trigger on `auth.users` is more reliable than a client-side RPC or a Database Webhook → Edge Function chain. The trigger fires atomically within the auth transaction — no network hop, no cold-start, no gap from a client crash. Client-side `recordAuthAuditEvent` calls are kept as belt-and-suspenders; duplicate records in an append-only audit log are acceptable. `logout` is client-only because session invalidation does not update `auth.users` rows. The `check:audit` guardrail verifies the trigger exists in migrations and that all server-capturable event types are handled in the trigger function.

## Audit operational controls at the database write boundary

Runtime controls such as `feature_flag_overrides` can be changed by service-role SQL, scripts, or a future admin UI. Auditing only a UI toggle leaves existing write paths invisible. `feature_flag_audit_events` is therefore written by a fail-closed trigger on the override table: every insert, update, and delete commits with its audit row or neither commits. `check:audit` requires this trigger coverage and rejects exception swallowing in that trigger.

## Narrow untrusted data once at its boundary

Provider JSON, RPC/realtime payloads, JSON relations, and persisted cache reads are runtime input even when TypeScript knows the expected schema. Parse them in services or shared Edge Function guard modules before exposing domain types.

- Collection reads drop malformed items and emit only a privacy-safe boundary identifier.
- Singular/action reads use their existing null or error path when payloads are invalid.
- Privileged Edge Function requests reject malformed bodies before service-role reads or writes.
- `npm run test:type-safety` exercises parsers and `npm run check:risk-guardrails` blocks assertion regressions.
