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

## Narrow untrusted data once at its boundary

Provider JSON, RPC/realtime payloads, JSON relations, and persisted cache reads are runtime input even when TypeScript knows the expected schema. Parse them in services or shared Edge Function guard modules before exposing domain types.

- Collection reads drop malformed items and emit only a privacy-safe boundary identifier.
- Singular/action reads use their existing null or error path when payloads are invalid.
- Privileged Edge Function requests reject malformed bodies before service-role reads or writes.
- `npm run test:type-safety` exercises parsers and `npm run check:risk-guardrails` blocks assertion regressions.
