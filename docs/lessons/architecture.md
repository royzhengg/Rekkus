# Lessons: Architecture

## Typecheck must run on every pull request

Do not place `typecheck` behind a branch-only workflow condition. A check that only runs after merging to `main` lets TypeScript regressions merge before they become visible.

## Unsafe assertions are not type-safety fixes

`as unknown as <Type>`, `as any`, suppression directives, and runtime non-null assertions hide missing narrowing rather than establishing a valid contract. Use generated types, typed service wrappers, boundary guards, and explicit required-value helpers instead.

**Guardrail:** `check:unsafe-any`, lint, and `check:risk-guardrails` block new assertion shortcuts in app-facing runtime code.

## Canonical patterns limit regression surface

Agents should extend the named canonical loading, error, modal, image, route, and async-query patterns instead of adding another variant. When several implementations solve the same problem, consolidation is safer than a new optional behaviour.

## Shared UI does not own route construction

Inline route strings and navigation choices in shared components create cross-feature regressions. Shared UI emits typed actions; feature screens or route coordinators construct navigation through helpers in `lib/routes/`.

## Async orchestration stays out of presentation components

Retry, cancellation, sequencing, and data-fetch state belong in hooks or services. Presentation components receive data, loading, and error state rather than owning service-call lifecycles.

## Runtime visual kill switches must be reactive

A remotely disabled visual flag does not provide rollback if persistent mounted chrome reads it once and never rerenders. Use `useFeatureFlag()` for rendered flag state; keep `isEnabled()` for service/action-time branches.

**Guardrail:** B-531 tests an enabled-to-disabled override refresh against persistent tab chrome ownership.

## Bug fixes need a guardrail

When fixing a recurring bug class, add the smallest automated check that would have caught it. For UI regressions, this can be a script-level scanner before a full test suite exists.

**Why:** A fix without a guardrail relies on memory. The next screen or refactor can quietly reintroduce the same issue.

---

## Guard code needs fixture tests

Parsing, route-param, provider-response, scanner, and Edge Function payload guards should have fast fixture tests that run outside the app runtime.

**Why:** Guards are the boundary between unknown input and trusted app types. If the guard drifts, TypeScript still looks green while bad data reaches shared code.

---

## Neutral shared modules break import cycles

Extracted components should not import types, constants, or formatters from the parent screen that imports them. Put shared screen-local contracts in a neutral sibling module, then import from both sides.

**Why:** Parent-child import cycles make refactors brittle and confuse agents because ownership points in both directions.

---

## Documented checks must exist

If AGENTS.md tells agents to run a command, `package.json`, CI coverage, and the workflow should all know about it.

**Why:** Missing scripts turn definition-of-done rules into false confidence.

---

## Automation checks need CI coverage

When adding a new `check:*`, `validate*`, or release-readiness command, wire it through `package.json`, the relevant composite script, `.github/workflows/ops-checks.yml`, and `scripts/check-ci-coverage.js` in the same change.

**Why:** Local-only guardrails drift quietly. CI coverage makes automation failures visible before a PR merges.

---

## Match Expo native modules to the bundled SDK version

Before adding Expo native modules, check `node_modules/expo/bundledNativeModules.json` and install the bundled compatible version.

**Why:** Newer package versions can install cleanly while still being incompatible with the current iOS/Android native runtime.

---

## Preserve private text by linking to context, not copying content

Comment bodies, message bodies, report notes, captions, and free-form private text should stay in their owner tables and moderation flows. Notifications, alerts, analytics, and audit events should use context-safe labels like "commented on your post" plus entity IDs.

**Why:** It keeps push payloads, analytics, and audit logs privacy-safe while still giving users a clear path back to the relevant content.

---

## Extract data fetching into custom hooks

Never write Supabase queries directly inside screen components. Put them in `lib/hooks/useXxx.ts`. Screens render UI; hooks fetch data.

**Pattern:**

```ts
// lib/hooks/useSavedLocations.ts
export function useSavedLocations(userId: string | undefined) {
  // all fetch logic here
  return { savedLocations, error, refresh }
}
// screen: const { savedLocations } = useSavedLocations(user?.id)
```

**Why:** When queries are inline, they're hard to test, hard to reuse, and the screen file grows unmanageable. Hooks also make it trivial to swap Supabase for a different backend later.

---

## Always handle errors from Supabase

Every query must check `error` and surface it. Silent failures make debugging impossible.

**Pattern:**

```ts
const { data, error } = await supabase.from('table').select(...)
if (error) { setError(error.message); return }
```

**Why:** Supabase can fail for many reasons (RLS, network, schema changes). Without an error state the user sees nothing and you have no signal.

---

## Collections organise bookmarks; they are not bookmarks

For saved-content libraries, keep one base save row per target kind and treat collection membership as organisation. Collection-add should atomically ensure the base save; confirmed unsave should remove owned memberships and the base save together.

**Why:** Two independent sources of saved intent drift as soon as users collect, uncollect, or unsave an item.

---

## Add `.limit()` to every query from the start

Every Supabase query must have an explicit limit. Use `100` as a default cap; bump when adding pagination.

```ts
.select('...').eq('user_id', userId).limit(100)
```

**Why:** Unbounded queries return everything in the table as the dataset grows. Adding limits later requires finding every query across the codebase.

---

## Regenerate Supabase types instead of casting around missing schema

If a table or RPC exists in migrations but is missing from `types/database.ts`, update the generated type surface before touching callers. Do not bridge gaps with `supabase as any`.

**Pattern:** `npm run typegen:supabase:local`; `npm run check:supabase-types` verifies the committed file when local Supabase is running and skips cleanly when it is unavailable.

**Why:** Generated types are the boundary between schema truth and app code. `as any` there hides schema drift in search, notifications, moderation, and shared services.

---

## Hidden-risk fixes need explicit scanners

Subtle operational bugs often look harmless to lint and TypeScript: one migration key set too early, one floating DB-first promise, one provider service writing analytics directly, or one shared component owning a route. Add a small scanner when a bug class is easy to reintroduce.

**Pattern:** `npm run check:risk-guardrails` owns hidden coupling, fallback-order, migration-retry, and analytics-boundary checks.

**Why:** Future agents follow visible rails. Silent architectural assumptions need executable reminders.

---

## Ratchets beat broad hygiene rewrites

When a dangerous pattern has a small current footprint or backlog-owned debt, block new instances immediately and remediate existing hotspots only when behavior is clear. Empty catches, deep imports, stale flags, and oversized shared files now follow this pattern.

**Pattern:** enforce clean categories directly; keep any baseline exception in a small allowlist whose reason starts with a `B-###` owner.

**Why:** This improves future code without forcing risky rewrites into a guardrail pass.

---

## Release Supabase type checks must be strict

Local development can skip Supabase type freshness when the CLI/runtime is unavailable, but release checks must fail instead of shipping with stale `types/database.ts`.

**Pattern:** use `npm run check:supabase-types:strict` inside `check:release`.

**Why:** Schema drift is a release risk, not a lint preference.

---

## Keep public barrels stable while splitting shared hotspots

When a large shared file is already imported across features, split its implementation into focused sibling modules and retain its original entry point as a re-export barrel.

**Pattern:** move coherent domains internally, run cycle checks, then remove the LOC ratchet exception only after the original entry file is below budget.

**Why:** Agents get smaller ownership surfaces without creating consumer churn or a risky repo-wide import migration.

## Onboarding new-user detection without a DB migration

Rather than adding an `onboarding_completed_at` column, detect new users by checking if `profiles.username` is null after Google OAuth. Email signup always routes to onboarding. This avoids a migration and uses existing state — but breaks if username ever becomes non-required. Document the dependency if the `profiles.username` constraint changes.

## First-time UI state via AsyncStorage flag

One-time feed nudges use a namespaced AsyncStorage key (`rekkus:first-feed-visit:v1`) set at the end of onboarding and cleared on first interaction. This avoids route params (which don't survive tab switches), persists across component remounts, and requires no DB column. The tradeoff: lost on app reinstall, which is acceptable for a cosmetic nudge.
