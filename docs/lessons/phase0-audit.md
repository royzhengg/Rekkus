# Lessons: Phase 0 Audit Learnings (2026-05-20)

## Token definition without enforcement is false confidence

Spacing.ts, Typography.ts, Colors.ts, and lib/animations.ts were all correctly defined, but features/ bypassed them with hardcoded values (74 hex colors, 1,000+ raw px spacing values, 100+ inline fontSize values). A token system that is not enforced by a CI check (`check:tokens`, `check:darkmode`) does not exist in practice — it is documentation only.

**Apply when:** adding any new design token. Add the CI check in the same PR, or the token will be ignored.

---

## God component gravity: decompose before the file exceeds 600 LOC

ConversationScreen (2,375 LOC), SearchScreen (1,893 LOC), and PostDetailScreen (1,290 LOC) grew because each new feature landed in the nearest existing screen without a size guardrail. After 1,000 LOC, adding a feature doubles the regression surface and makes parallel work impossible. The `check:architecture` script (fail if features/ file >600 LOC) prevents this class from silently compounding.

**Apply when:** adding any feature to an existing screen. If it pushes the file past 600 LOC, extract first.

---

## Warning-fatal lint needs a low-noise rule set

`npm run lint` fails on warnings, so warning-level rules are production gates. Keep the repo-wide lint set limited to issues that can be fixed mechanically or locally. Broad behavior-sensitive rules like exhaustive hook dependencies and promise handling should land after the existing debt is corrected.

**Apply when:** adding an ESLint rule. Run it locally first; if it exposes broad existing debt, track the cleanup before making it a fatal repo-wide gate.

---

## Dark mode regressions are invisible without a sweep tool

`#fff`, `#FEE2E2`, and `white` in auth screens only manifest as regressions in dark mode on-device. Light-mode development never catches them. The `check:darkmode` CI script (grep for literal light-only hex codes in features/) is the only reliable prevention. Without it, each new screen adds more hardcoded light values.

**Apply when:** adding any color or background to a screen. Run `check:darkmode` before committing.

---

## Animation tokens must be implemented in the same PR they are defined

`EMOJI_STAGGER_MS` was defined in lib/animations.ts but never called — dead code. Animation tokens defined without implementation accumulate as aspirational comments. Rule: if a new animation constant is added to lib/animations.ts, it must be used in the same PR. Otherwise, delete it.

**Apply when:** adding any animation token, timing constant, or press scale to lib/animations.ts.

---

## `as any` is contagious — fix with typed wrapper functions, not inline casts

220 `as any` instances originated from a pattern of bypassing Supabase client typing with inline casts. Each instance suppresses type errors locally but breaks the type graph upstream. The fix is typed wrapper functions in the service file (using types/database.ts generated types). The ESLint rule `@typescript-eslint/no-explicit-any` is the only prevention — AGENTS.md rules alone do not enforce it.

**Apply when:** any new Supabase call is written. Create a typed wrapper function in lib/services/. Never cast.

---

## AGENTS.md engineering rules need CI enforcement to be effective

Rules like "use tokens" and "no direct DB in screens" in AGENTS.md are advisory until backed by a CI check or ESLint rule. Without enforcement: PostDetailScreen accumulated 10+ direct supabase calls despite the existing rule. For each architectural rule in AGENTS.md, there must be a corresponding automated check. The rule and its check should be added together.

**Apply when:** adding any new rule to AGENTS.md. Ask: "What check enforces this?" Add both or add neither.

---

## Bug prevention automation compounds; bug fixing does not

Fixing 74 hardcoded hex colors is one sprint. Adding `check:tokens` to CI prevents all future occurrences permanently at zero marginal cost. For any recurring bug class (dark mode regressions, direct DB in screens, as-any proliferation), implement the preventative check before fixing existing instances. The check has higher ROI than the fix.

**Apply when:** closing any bug fix. Before closing, ask: "What check prevents this class from returning?"

---

## Dark mode bug class: `backgroundColor` with hardcoded white/light values

Auth screens (Login, Signup, Welcome, SignupProfile) had `backgroundColor: '#FEF0F0'` for error boxes and `backgroundColor: '#fff'` for Google buttons. In dark mode, `c.text` (light) rendered on these static white backgrounds — invisible. Settings screens (ChangePassword, ChangeEmail) had `backgroundColor: '#FEE2E2'` with the same pattern.

Fix: replace with `c.errorBg` (light `#FEF0F0` / dark `#3D1A1A`) and `c.surface` (adapts per theme). Both tokens already existed in Colors.ts.

Prevention: `scripts/check-darkmode.sh` catches `backgroundColor` using `#fff`, `#ffffff`, `#FEE2E2`, `#FEF0F0`, or `'white'` in features/ and components/. It runs via `npm run check:darkmode` and is part of `check:hygiene`. It excludes `fill=` lines (SVG brand colors) and `color:` props (white text/icons on dark overlays are intentional).

Key distinction: `color: '#fff'` on an icon or text overlaid on a photo/colored button is intentional and not caught. `backgroundColor: '#fff'` on a UI element that sits on the screen background is always wrong — use `c.surface`, `c.bg`, or `c.white`.

**Apply when:** adding any new screen, modal, or UI component. Never use a hardcoded hex for `backgroundColor`. Always use a `useThemeColors()` token.

## Shared UI must own repeated error and icon-button patterns

Auth/settings screens drifted into duplicate error boxes, and compact icon-only buttons repeated 34x34 styles without a 44pt hit target. Repeated UI primitives should move into `components/ui/` before the next copy is added.

Fix: `ErrorMessage` owns themed error boxes and `IconButton` owns compact icon-only controls with computed hitSlop.

Prevention: `check:a11y` catches legacy compact icon-button style definitions, and `check:tokens` scans `components/` as well as `features/` so component-level overlay literals do not bypass CI.

**Apply when:** adding any new error state, modal backdrop, or icon-only action. Use the primitive and theme token first; add `check:tokens-ignore` only for intentional media-on-photo treatments.

---

## Mock data must route through `lib/dataSources/demoData`, never imported directly from `lib/mocks`

`lib/mocks/data.ts` exports raw demo data. `lib/dataSources/demoData.ts` is the config-aware gate — it returns empty arrays/objects when `ALLOW_MOCK_DATA` is false (live mode). Screens that import directly from `lib/mocks` bypass this gate and render demo data in production builds.

Fix: import `demoUsers`, `demoRestaurants`, `demoCurrentUser` only from `@/lib/dataSources/demoData`.

Prevention: ESLint `no-restricted-imports` rule blocks `@/lib/mocks` and `@/lib/mocks/data` in `features/` and `app/`. Added in ARCH-007.

**Apply when:** adding any reference to demo/mock data in a screen or app route.

---

## Auth screen `canSubmit` must use `isValidPassword`, not `hasCurrentPassword`

`hasCurrentPassword(password)` returns `true` for any non-empty string — it only checks `length > 0`. `isValidPassword(password)` enforces the 8-character minimum. The names look symmetrical; the behaviour is not. Using `hasCurrentPassword` in a `canSubmit` gate lets a user type a 7-character password and submit — Supabase will reject it on the server with a cryptic error.

Fix: in any auth form where the user is setting or verifying their own password against the 8-char rule, use `isValidPassword()`. Reserve `hasCurrentPassword()` for "current password" fields where you're only checking the field is filled (the server validates correctness).

Prevention: centralised validators live in `lib/utils/validation.ts`. All new auth screens must import from there — never inline a password length check.

**Apply when:** adding any auth or settings screen with a password field.

---

## Service-boundary fixes should remove the allowlist entry

Moving direct Supabase calls out of a screen is only half the fix if the architecture check still allowlists that screen. The regression guard is complete when the screen imports no Supabase client and `scripts/check-architecture.sh` no longer exempts it.

Fix: when PostDetailScreen, CreateGroupScreen, and EditProfileScreen were moved behind services, their Supabase allowlist entries were removed in the same change.

Prevention: run `npm run check:architecture` after each service-boundary cleanup and verify the cleaned file is not still listed under `SUPABASE_ALLOWLIST`.

**Apply when:** closing any ARCH item that moves DB or storage calls from `features/` or `app/` into `lib/services/`.

## LOC allowlists must point to open backlog work

Keeping an oversized screen in `LOC_ALLOWLIST` after the split ships turns the architecture check into decoration. The allowlist should only contain files with an open restructure row, and the row should describe the exact remaining extraction target.

Fix: ARCH-017 through ARCH-021 removed their allowlist entries after the screens were brought below 600 LOC. `check:architecture` now fails if a LOC allowlist entry does not map to an open backlog row.

**Apply when:** closing any file-size cleanup item.

## Hooks need the same LOC guardrail as screens

`lib/hooks/useSearch.ts` grew to 1,126 LOC because `check-architecture.sh` only covered `features/` — hooks were invisible to CI. Every new search feature landed in the same hook without friction. The fix: add a second `find lib/hooks` pass in the architecture script with the same 600-line hard limit and no allowlist. Soft budgets now warn before `features/`, `lib/hooks/`, `components/`, and `lib/services/` hit hard-to-split sizes.

**How to apply:** when you extend the LOC check to a new directory (e.g. `lib/hooks/`), do it with no allowlist — an allowlist would recreate the same accumulation problem. Hooks that are already over the limit must be split before the guardrail is added.

---

## Safe split pattern: internalize modal/action state into the extracted component

When splitting a god-component (ConversationScreen, SearchScreen), the temptation is to keep all modal/sheet state in the coordinator and pass open/close callbacks down. This creates more prop drilling than the original. Instead, move owned state into the extracted component and expose an imperative `ref` handle: `actionsRef.current.open(msg, pageY)`. The coordinator calls the handle; the sheet manages its own visibility. This is the pattern used for `MessageActions` (ARCH-005) and `SearchFiltersSheet` (ARCH-004).

**Apply when:** extracting any component that owns modal or action sheet state.

---

## Scoring/utility functions belong in `lib/utils/`, not co-located with the hook that uses them first

Pure scoring functions (scorePost, scorePlace, matchesFilters, boundingBoxForRadius) in `useSearch.ts` had no natural home and accumulated in the hook. Moving them to `lib/utils/searchScoring.ts` reduces the hook by ~400 LOC, makes them independently testable, and stops future search features from adding more scoring logic to an already-full hook.

**Apply when:** a hook file contains pure functions that take only plain data (no React state, no effects). Extract to `lib/utils/`.

---

## `(supabase.from('table') as any)` casts are always unnecessary

When the Supabase client is typed as `createClient<Database>()`, all `.from('table')` calls are already typed via the generated `Database` schema. The `as any` cast adds nothing and hides real type errors. Remove it and the return type is correctly inferred from `types/database.ts`.

**Apply when:** reviewing any Supabase query that uses `as any` — 99% of the time it can be deleted outright.

---

## Expo Router typed-routes limitation requires `as never` or eslint-disable

Expo Router's typed-routes feature doesn't cover all dynamic route patterns at compile time. Casts like `router.push('/messages/[id]' as any)` are a known limitation. Use `as never` (preferred — no lint suppression needed) or add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` before the call. Never fight the type system with complex workarounds here.

**Apply when:** any `router.push` / `router.replace` call with a dynamic segment needs a type cast.

---

## `Record<string, unknown>` replaces `as any` for JSONB columns

Supabase JSONB columns (`attachment_metadata`, `extra_data`, etc.) come back typed as `Json | null`. Casting to `as any` to access properties silences all type errors. Use `as Record<string, unknown> | null` instead — it permits optional property access while satisfying `no-explicit-any` and keeping downstream code type-safe.

**Apply when:** accessing properties on a Supabase JSONB column result.
