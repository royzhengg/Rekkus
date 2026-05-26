# Lessons Learnt — Rekkus

Index of durable learnings. One line per rule — open the linked file only when the task touches that area.

To add a lesson: append to the relevant topic file in `docs/lessons/`, then add/update the one-liner here.

---

## Testing → [docs/lessons/testing.md](lessons/testing.md)

- **`EXPO_PUBLIC_*` env vars are compile-time constants in Jest** — `babel-preset-expo` inlines them; runtime `process.env` mutation cannot change them after module load
- **Coverage thresholds must be achievable on day one** — set a floor at current coverage, document the progression target in comments
- **Critical shared paths need per-module coverage ratchets** — aggregate coverage alone can stay green while route, transform, service, or async-hook protection disappears (B-512)
- **`tests/type-safety/` uses Node's native `test` runner** — exclude it from Jest via `testPathIgnorePatterns`
- **Disable Watchman in Jest config** — agent sandboxes can fail before tests run when Watchman cannot write state
- **External API providers need an independent feature flag** — so they can be killed without a release or disabling the parent feature
- **Test scripts in package.json are inert without a config file** — packages installed + scripts wired ≠ tests runnable; `jest.config.js` is required for Jest to find and transform files
- **Mock module-load side-effects before importing the module under test** — `jest.mock('@/lib/featureFlags', ...)` must precede the import of any file that imports featureFlags at module scope; hoist mocks are automatically applied before imports
- **Test compiler configs are source; emitted scratch output is not** — keep fixture `tsconfig` files tracked with current compiler options and ignore generated `.temp/` output

## Architecture → [docs/lessons/architecture.md](lessons/architecture.md)

- **`typecheck` must run unconditionally on PRs** — a single `if: github.ref == 'refs/heads/main'` condition silently hid TS errors for all PR merges; CI typecheck must have no condition guard
- **`as unknown as <Type>` is prohibited** — same blast radius as `as any`; bypasses type narrowing; caught by `check:unsafe-any` ratchet. 38-instance baseline paid down in B-507; ratchet now locked — allowlist capped at 2 entries via count assertion, new entries fail CI with policy message. Fix patterns: (A) direct `supabase.rpc()` for typed-client casts; (B) single `as T` or `QueryData<>` for `.select()` returns; (C) `Record<string, Json>` input types for Json parameter casts. Non-literal select strings (template interpolation) lose Supabase type inference — prefer inline literals for queryshape derivation.
- **Non-null assertions (`!`) are prohibited in app code** — `@typescript-eslint/no-non-null-assertion: 'error'` blocks new violations; explicit `Lint` CI step (separate from `Hygiene`) makes failures immediately visible on PRs (B-514). Deno env reads in `supabase/functions/` use a `requireEnv` helper that throws with a descriptive message instead of a silent null crash.
- **Canonical pattern registries are not optional in AI-assisted repos** — without a named canonical, agents add a new variant every time; 3 error patterns, 2 loading patterns were discovered during stabilisation audit
- **Variance is a compounding risk** — each new variant multiplies regression surface area; prefer consolidation over expansion; finding 3 existing implementations is a reason to consolidate, not to add a 4th
- **Navigation regressions come from inline route string construction in shared components** — typed route helpers in `lib/routes/` prevent the entire bug class; shared components must not own navigation decisions (B-504)
- **Collections organise bookmarks; they are not bookmarks** — collection-add must ensure a base save, and confirmed unsave removes memberships with that base save (B-283)
- **Async orchestration in presentation components causes retry chaos, cancellation bugs, and state race conditions** — async belongs in hooks/services; components receive data/loading/error tuples
- **Bug fixes need a guardrail** — add the smallest automated check that would have caught it
- **Guard code needs fixture tests** — scanner/provider/route/storage guards need fast tests outside app runtime
- **Neutral shared modules break cycles** — extracted screens/components should not import types/constants back from their parent screen
- **Documented checks must exist** — if AGENTS.md names a check like `validate`, package scripts and CI coverage must enforce it
- **Automation checks need CI coverage** — new `check:*` and validation scripts must be wired into package scripts, hygiene, workflow, and CI coverage
- **Ratchet hidden engineering debt** — fail new empty catches, deep imports, stale flags, and oversized shared files; keep existing exceptions backlog-linked
- **Keep compatibility barrels when splitting shared hotspots** — move ownership internally while existing feature imports remain stable
- **Hidden-risk fixes need explicit scanners** — race, migration, analytics-boundary, and shared-navigation fixes need small guardrails
- **Match Expo native modules to bundled SDK** — check `bundledNativeModules.json` before installing
- **Preserve private text** — notifications/analytics use labels + IDs, not copied content
- **Extract data fetching into hooks** — `lib/hooks/useXxx.ts`; screens never query Supabase directly
- **Always handle Supabase errors** — check `error` on every query or surface it
- **Add `.limit()` to every query** — default cap 100; bump when adding pagination

## Performance → [docs/lessons/performance.md](lessons/performance.md)

- **`React.memo` on list-item components** — prevents re-renders on parent state change
- **`useCallback` for handlers passed to memoized children** — inline lambdas defeat memo
- **`react-native-reanimated` for all animations** — never `Animated` from react-native
- **`React.memo` on icon components** — icon functions recreate on every parent render
- **`useMemo` for computed/derived values used in render**
- **Performance regressions need executable budgets** — hard LOC limits fail, heuristic memoization findings warn

## Native / Maps → [docs/lessons/native-maps.md](lessons/native-maps.md)

- **Google Maps on iOS needs THREE things** — `iosGoogleMapsApiKey`, Podfile subspec, `GMSServices` call
- **Always keep `MapView` mounted** — hide with `opacity: 0`, never conditional render
- **`tracksViewChanges={false}` on all `<Marker>` components** — default re-renders every frame

## Supabase Queries → [docs/lessons/queries.md](lessons/queries.md)

- **Parallelise independent queries** — `Promise.all` not sequential awaits

## Styling → [docs/lessons/styling.md](lessons/styling.md)

- **`useMemo(() => makeStyles(c), [c])`** — never module-level StyleSheet with colour tokens

## Shared Components → [docs/lessons/shared-components.md](lessons/shared-components.md)

- **Components that own service calls accumulate complexity faster than screens** — `StepMedia.tsx` grew to 948 LOC by owning Google Places API, restaurant upsert, and FTS search; enforce hook extraction before this pattern repeats (B-506)
- **Check `components/` before writing any icon/badge/rating** — see import table in topic file
- **Chips → `Chip.tsx`; empty states → `EmptyState.tsx`** — never inline these primitives
- **`PostRatingStrip` replaces all emoji ratings** — never `🍴{post.food}` in JSX
- **`OpenBadge` replaces all inline open/closed badge styles**
- **Context-preserving Create `+`** — sheet over current screen, not tab focus
- **Rekkus Picks are user-facing** — Taste/Value/Occasion; Food/Vibe/Cost are compatibility fields
- **Dark mode maps keep colour** — not grayscale; water blue, parks green, markers high-contrast
- **`PostCardSkeleton` for feed loading, not `ActivityIndicator`** — use when `!followingLoaded`; spinner only for action buttons and pagination footers
- **Skeleton rows for list/screen loading, not centered `ActivityIndicator`** — all message/contact screens use 3–4 `skeletonRow` entries; `check:design` blocks `styles.*center* + ActivityIndicator` from re-entering CI
- **Failed uploads need explicit recovery** — never surface a failed upload with dismiss-only; always pair with "Go to draft" or "Try again" so users know how to recover

## Hook Declaration Order → [docs/lessons/hooks.md](lessons/hooks.md)

- **Declare `useMemo`/`useCallback` values before the hook that depends on them** — temporal dead zone

## Utilities / Config → [docs/lessons/utilities.md](lessons/utilities.md)

- **Centralise utilities at first reuse** — move to `lib/utils/` when a function appears in a second file
- **Never use `process.env` directly** — read from `lib/config.ts`
- **Dormant Sentry keeps build wiring intact** — gate initialisation and wrapping behind explicit public enablement plus DSN; retain plugin metadata and keep auth token EAS-only

## Services Layer → [docs/lessons/services.md](lessons/services.md)

- **Supabase calls and provider types belong in `lib/services/`** — hooks/contexts compose typed services; architecture and lint checks enforce the boundary (B-493)
- **Retire superseded RPC overloads when return shapes change** — otherwise PostgREST/typegen can resolve an older contract and hide fields needed by runtime consumers (B-283)
- **Narrow untrusted data once at its boundary** — provider, RPC/realtime, JSON relation and persisted-cache payloads use fixture-tested service guards; privileged Edge requests reject malformed bodies before writes (B-511)
- **Audit wiring belongs in the same PR as the mutation** — mutations that predate the audit rule accumulate compliance gaps; `check:audit` now scans all migration files for the view (not just the named view file) so any new `*_audit_events` table without a view arm fails CI immediately (B-517, B-518)
- **Server-side auth audit uses a PostgreSQL trigger, not an Edge Function** — atomic with auth transaction, no cold-start, no client-crash gap; `logout` is client-only (session invalidation doesn't update `auth.users`); `check:audit` enforces trigger existence and event-type coverage (B-519)
- **Audit operational controls at their database write boundary** — feature flag overrides may be changed without an admin UI, so a fail-closed trigger records every runtime override mutation regardless of caller (B-521)

## Analytics → [docs/lessons/analytics.md](lessons/analytics.md)

- **All analytics calls go through `lib/analytics.ts`** — never `supabase.from('analytics_events')` in screens
- **Provider telemetry uses analytics boundary** — no direct `analytics_events` writes from provider services
- **Analytics rows need versioning, sampling, and 90-day raw retention**

## Design System → [docs/lessons/design-system.md](lessons/design-system.md)

- **No magic numbers** — import from `constants/Typography`, `constants/Spacing`, `constants/Colors`
- **`ScreenHeader` replaces the repeated 56px topBar pattern**
- **`ThumbGrid` replaces duplicated 3-col photo grids**
- **Shadow styles are tokens** — use `constants/Elevation.ts` presets; `check:design` blocks raw values
- **Contrast tokens need executable audits** — `check:a11y` should calculate text-token ratios
- **Routine failures use `ErrorMessage`; sheets require a recovery action** — `check:design` blocks inline error boxes, failure alerts, and dismiss-only failure notices
- **Canonical UI patterns require accepted ADR links** — `check:docs` blocks active registry entries without a recorded decision; loading uses spinner, skeleton, or `<EmptyState loading>` according to context (B-515)

## Dead Code → [docs/lessons/dead-code.md](lessons/dead-code.md)

- **Dead-code tooling: keep in report-only mode before CI-blocking** — Expo dynamic imports and feature-flagged code generate false positives; audit before enabling phase 2 (B-513)
- **Knip phase 2 baseline uses `ignoreIssues` per file, not `ignoreExports` (field doesn't exist in v6)** — add `types/database.ts` to `entry` for indexed-type false positives; see dead-code.md
- **Delete Expo template files at setup** — `EditScreenInfo`, `ExternalLink`, `StyledText`, etc.
- **Flags without isEnabled() gates are decorative** — every flag needs a call site; `check:stale-flags` enforces this

## UX Copy → [docs/lessons/ux-copy.md](lessons/ux-copy.md)

- British English; "Tap" not "Click"; "Create account" not "Sign up"; full caps only for status labels
- CTAs specific; error messages say what happened + what to do; empty states prompt next action

## Async Safety → [docs/lessons/async-safety.md](lessons/async-safety.md)

- **Debounced async ownership begins before the timer fires** — invalidate in-flight work on query change, clear, and unmount; claiming only inside the callback leaves a stale-response window (B-512)
- **Fatal promise/dependency lint only works after intentional cleanup** — await UX work and explicitly report truly background failures

## Search → [docs/lessons/search.md](lessons/search.md)

- **Geographic data in DB, not TypeScript** — DB table + pg_trgm index, not a hardcoded TS map
- **Cache-first, API-last** — check DB before any paid API call; store result with TTL afterward
- **Await DB location resolution before paid fallback** — async suburb/geocode resolution must not race into Google calls

## Phase 0 Audit → [docs/lessons/phase0-audit.md](lessons/phase0-audit.md)

- **Token definition without CI enforcement is false confidence**
- **Warning-fatal lint needs low-noise rules** — broad debt cleanup comes before fatal repo-wide gates
- **God components: decompose before 600 LOC** — `check:architecture` enforces hard limit
- **Dark mode regressions need `check:darkmode`** — light-mode dev never catches them
- **Animation tokens must be implemented in same PR** — unused tokens get deleted
- **`as any` is contagious** — typed wrapper functions in `lib/services/`, not inline casts
- **Every AGENTS.md rule needs a CI check** — advisory rules without enforcement are ignored
- **Bug prevention compounds; bug fixing does not** — add guardrail before closing any bug class
- **`backgroundColor` hardcoded white/light = dark mode bug** — always use `useThemeColors()` token
- **`ErrorMessage` + `IconButton` own error boxes and icon controls**
- **Mock data routes through `lib/dataSources/demoData`** — never import `lib/mocks` directly
- **`canSubmit` must use `isValidPassword`**, not `hasCurrentPassword` (length > 0 only)
- **Service-boundary fix removes the allowlist entry** — clean the check, not just the screen
- **LOC allowlists must point to open backlog work** — otherwise the check is decoration
- **Hooks need the same 600-LOC guardrail as screens** — soft budgets warn before hard limits
- **Safe split pattern: imperative `ref` handle** — extracted components own their modal state
- **Scoring/pure functions → `lib/utils/`** — not co-located in the hook that uses them first
- **`(supabase.from(...) as any)` casts are always unnecessary** — client is already typed
- **Expo Router dynamic routes: use `as never`** — not `as any`
- **JSONB columns: `as Record<string, unknown> | null`** — not `as any`
- **Unsafe inputs stop at boundaries** — parse JSON/storage/routes/provider data as `unknown`, then narrow
- **Missing Supabase tables/RPCs mean regenerate types** — never bridge with `supabase as any`
