# Rekkus Agent Guide

Canonical AI/operator guide. Use before `CLAUDE.md`.

## Authority Order

1. `PRODUCT.md` — strategic product truth
2. `BACKLOG.md` — execution order and roadmap
3. `AGENTS.md` — AI/operator behavior
4. Specialized docs — domain truth for architecture, security, release, product, design, analytics, UI

On conflict: prefer the most specific doc; update stale docs as part of the work.

## Product Direction

Build Rekkus as a social review and recommendation platform. Food is current niche; dish-first discovery is the differentiator, not the platform identity.

Not: generic restaurant directory, generic review platform, maps clone, AI chatbot app, influencer-first social feed.

Prioritise: content density, saves, collections, dish graph, taste graph, local discovery, then monetisation.

## Execution Principles

- Work incrementally; no giant rewrites.
- Deterministic systems before AI; local DB first, Google fallback second.
- Boring, observable automation over hidden magic.
- Low operational burden; preserve user-facing behaviour unless explicitly changing it.
- Reuse existing components, hooks, services, utilities, docs before creating new.
- New dependencies only when value clearly beats maintenance + bundle + security cost.
- Risky behaviour must be reversible via flags, rollbacks, or additive migrations.

Priority order: Stability → Simplicity → UX clarity → Operational visibility → Cost efficiency → Performance → Feature velocity → Abstraction

## Multi-Agent Coordination

Start: pull latest; read `AGENTS.md`, `BACKLOG.md`, `worklog.md`, `backlog-counter.md`, `lessons.md`, relevant `docs/lessons/*`; create/switch to dedicated branch.

Ownership:
- Claim work in `worklog.md` before editing code; claim file ownership before modifying files.
- Never edit files claimed by active sessions unless the claim explicitly allows overlap.
- If required files are exclusively claimed: stop, report the conflict, do not continue.
- Shared files (`BACKLOG.md`, `worklog.md`, docs, broad service test files) may overlap only when both rows document non-conflicting scope.
- **Section-level claiming for backlog files:** When claiming `BACKLOG.md`, name the specific section in the "Files claimed" cell (e.g., `BACKLOG.md § V1 Search & Discovery`). When claiming `COMPLETED_ITEMS.md`, include the ID range (e.g., `COMPLETED_ITEMS.md [B-580–B-590]`). Two agents (Claude Code or Codex) may work simultaneously only when their section/range claims do not overlap. `check:backlog-integrity` enforces this.
- Update `worklog.md` on start, scope change, ownership release, and completion.

Backlog IDs: never invent manually. Reserve in `backlog-counter.md` first, then increment immediately. Use existing `BACKLOG.md` 7-column format only; never create a new format. When skipping or absorbing an ID, insert a stub row in `COMPLETED_ITEMS.md` at the correct ascending-ID position explaining the disposition.

Coordination quality:
- Short bullets in coordination files; no long analysis.
- `lessons.md` reusable only; no session notes or debugging logs.
- Run `check:coordination` before completion when touching coordination files, backlog IDs, or worklog claims.
- Every bug fix includes practical prevention: tests, lint rules, guards, validation, lessons, or regression checks.
- Parallel agents only when ownership boundaries are clear.

## Repo Rules

- `app/` — Expo Router wrappers only
- `features/` — screen implementations and feature-local components
- `components/ui/` — reusable primitives, no business logic
- `components/` — cross-feature shared UI
- `lib/services/` — Supabase, Google, Expo, network calls
- `lib/hooks/` — reusable hooks
- `lib/contexts/` — React providers
- `lib/mocks/` — mock/demo data only
- `types/domain.ts` — app-facing domain types
- `types/database.ts` — generated Supabase types only

Never import `lib/mocks` from `app/` or `features/`; route through data-source boundaries.

## Engineering Rules

- `useThemeColors()` + memoised styles for themed UI. Colors, spacing, typography from existing constants.
- Reusable icons in `components/icons.tsx`; no inline screen-local SVGs.
- `RekkusActionSheet` for choice/action lists; no `ActionSheetIOS`.
- External calls behind services; no direct Google/Supabase logic in screens unless creating the service.
- Authenticated writes: auth check in app, RLS for authorisation. Service-role secrets only in Supabase Edge Functions. `EXPO_PUBLIC_*` values: no private secrets.
- **Cache-first, API-last:** Check DB before any paid external API (Google Places, geocoding, etc.). Store result with TTL (Google Places: 30-day per ToS; public reference data: indefinite). Reference: `restaurant_provider_cache` (infra table; keeps historical name), `lib/utils/locationResolver.ts`.
- **Token enforcement:** No hardcoded hex colours, pixel spacing, or font sizes in `features/`. Import from `constants/Colors.ts`, `constants/Spacing.ts`, `constants/Typography.ts`. Run `check:tokens` + `check:darkmode` before any styling commit.
- **Touch targets:** Min 44×44pt. Use `<IconButton>` (`components/ui/IconButton.tsx`); never raw `TouchableOpacity` with width/height < 44.
- **Android parity:** All flows, UI states, and navigation must work on Android before shipping. `Platform.OS`/`Platform.select` only for genuine platform affordances — never to gate core functionality. Verify on Android before marking any UI/navigation/permission change done.
- **Service boundary:** No `supabase` or Supabase provider types imported in `app/`, `features/`, `lib/hooks/`, or `lib/contexts/`. All DB/auth/API calls via `lib/services/`. Enforced by `check:architecture` + ESLint.
- **No unsafe typing:** No `as any`, `: any`, `@ts-ignore`, `@ts-nocheck`, eslint disables, or `as unknown as <Type>`. `@ts-expect-error` requires inline reason; exceptional only. Use `unknown`, type guards, generated Supabase types, typed wrappers. External JSON/storage/route params/JSONB must be narrowed before use.
- **No asserted runtime assumptions:** No non-null assertions in app/runtime code. No empty catches: surface failures, emit privacy-safe signal, or document intentional non-blocking fallback.
- **Async safety:** Await work that determines behaviour. `void` only when callee handles failures. Fatal promise + hook-dependency lint active; do not suppress.
- **Async regression protection:** Debounced async hooks must invalidate active work before early returns and on cleanup. Shared route/search/service/hook paths require behavioural tests with per-module coverage ratchets.
- **Signal capture at ship time:** Every new user-facing feature must capture its analytics signals in the same PR — never follow-up. Define impressions, clicks, exits; add `analytics.*` calls + `docs/analytics/ANALYTICS.md` entries before marking done.
- **God component prevention:** 400-LOC feature screens and 200-LOC hooks are complexity review thresholds, not automatic splits. Review cohesion; extract clearly distinct concerns only. `check:architecture` fails new oversized shared files; existing shared debt needs backlog-linked allowlists.
- **Circular dependencies:** Shared types/constants in neutral files; no importing from screens. `check:circular-deps` fails on source import cycles.
- **Predictable imports:** Use `@/` over three-or-more-level relative imports. New `TODO`/`FIXME`/`HACK` require `B-###` backlog ID. Feature flags need owner/review date; newly unreferenced flags fail `check:stale-flags`.
- **Animation tokens:** No new constants in `lib/animations.ts` without implementing them in the same PR. Unused tokens deleted, not left as aspirational comments.
- **Shared component discipline:** `components/` and `components/ui/` are presentation-focused. No cross-feature orchestration, navigation ownership, fetch, or mutation logic in reusable UI primitives. Navigation belongs in feature screens, route coordinators, or typed route helpers.
- **Async ownership:** Async orchestration in hooks or services — not components. Retry, cancellation, and sequencing in `lib/hooks/` or `lib/services/`.
- **Reduce variance:** Check Canonical Patterns before implementing any loading/error/modal/navigation/async-query pattern. Extend the existing canonical; never add a variant. Finding 3 existing implementations is a reason to consolidate.
- **Delete before add:** Before a new helper/abstraction/utility, check if an existing one can be extended or an obsolete one removed.
- **Explicit over implicit:** No optional props that silently alter behaviour, no inferred entity types, no hidden fallback branches, no overloaded components.
- **No premature generics:** No "universal" abstractions unless multiple stable, concrete use-cases already exist. Concrete first; extract when duplication is proven.
- **No cross-feature leakage:** Features must not depend on other features' internals. Shared contracts in `lib/`, `types/`, or shared layers.
- **State ownership:** One owner per state. No independently stored derived state; lift up or pass down.
- **Rendered feature flags:** Long-lived rendered UI that can be disabled remotely must use `useFeatureFlag()`, not `isEnabled()` once during render.
- **Runtime validation scope:** Lightweight validation only at unstable external/provider boundaries and persisted cache boundaries (Supabase RPC, Google Places, AsyncStorage). Trust TypeScript for internal code.
- **Shared abstraction modification:** Identify all consumers before modifying a shared component/hook/service. Prefer additive changes; breaking changes require atomic consumer updates.
- **Temporary code governance:** TODOs/FIXMEs/transitional wrappers require reason, removal condition, and `B-###` ID. Caught by `check:risk-guardrails`.
- **Safe refactor conditions:** Encouraged when adjacent logic is already changing, regression surface is small, duplication is clearly harmful, and practical verification exists. Blocked when files are large, have no tests, or are shared across many consumers.
- **Dependency governance:** New dependencies require: problem justification, comparison against existing stack, maintenance + security review, bundle/runtime impact, overlap analysis.
- **Compliance-mandatory:** Any change adding/removing/altering data collection, retention, user-visible content, provider API, auth, notifications, location, or analytics routing requires a Compliance Impact review against `docs/security/COMPLIANCE.md` before merging. New data fields → `COMPLIANCE.md` data inventory. New providers → terms review + data-flow entry.
- **Audit coverage:** Every new entity domain with mutable state ships an audit table (append-only, `FOR ALL USING (false)` RLS, no retention deletion) in the same migration + `platform_audit_events_view` entry. Write audit records via `SECURITY DEFINER` RPC only. Deletion records: no FK or `ON DELETE SET NULL`; never `ON DELETE CASCADE`. `check:audit` enforces at CI. See ADR 0011.
- **Scalability baselines:** Every new DB query: `.limit()` clause + index justification. New RPCs scanning tables > 10k rows: EXPLAIN ANALYZE in migration comment. Backfills > 10k rows: staged migration plan + rollback path before merging.
- **Performance philosophy:** Correctness and consistency before optimisation. Optimise only after real bottlenecks identified. No speculative `useMemo`/`useCallback`/`memo`.
- **Data shape governance:** External/provider payloads normalised at service boundaries. No provider-specific shapes (Google Places, Supabase raw types) leaking into the app. Normalise in `lib/services/`; components receive `types/domain.ts` types.
- **Regression surface awareness:** Every new variant/abstraction/optional behaviour increases regression surface. Ask: does this reduce or increase breakable paths? Prefer fewer, stable, well-understood paths.
- **Offline mutation enrollment:** Mutations added to `runDeferredMutation` (Phase 2 B-239b+) must declare: (1) rollback path with code reference; (2) retry policy (retryable or explicit-only); (3) cache invalidation path. Phase 2 offline mutations deferred to B-239b; do not enroll until scoped and approved.

## Canonical Patterns

Use the listed canonical for each pattern. No new variants. Extend the canonical if improvement is needed. Do not replace without updating this table and documenting why.

| Pattern | Canonical | State | Decision |
| --- | --- | --- | --- |
| Loading state (action / pagination) | `ActivityIndicator` from RN with a theme token | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Loading state (content-shaped) | `<Skeleton>` / `<SkeletonText>` matching the eventual surface | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Loading state (blocking full-screen) | `<EmptyState loading>` | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Error display | `<ErrorMessage>` (`components/ui/ErrorMessage.tsx`); no inline failure text, failure alerts, or dismiss-only failure sheets | Stable | [ADR 0006](docs/adr/0006-routine-and-actionable-failures.md) |
| Actionable failure recovery | `<RekkusActionSheet>` only when offering a recovery action (retry/review) | Stable | [ADR 0006](docs/adr/0006-routine-and-actionable-failures.md) |
| Success/info confirmation | `<Toast>` via `useToast()` — 3s auto-dismiss, bottom overlay, `accessibilityLiveRegion="polite"`; `ErrorMessage` for errors; `Alert.alert` only for destructive confirmations | Stable | [ADR 0017](docs/adr/0017-success-confirmation-patterns.md) |
| Connectivity and deferred sync status | `<ConnectivityNotice>` rendered once in root provider tree; no per-screen banner variants | Stable | [ADR 0016](docs/adr/0016-offline-write-recovery.md) |
| Modal / choice sheet | `<RekkusActionSheet>` (`components/ui/RekkusActionSheet.tsx`) | Stable | [ADR 0007](docs/adr/0007-in-app-choice-surfaces.md) |
| Image display | `<CachedImage>` (`components/ui/CachedImage.tsx`) | Stable | [ADR 0008](docs/adr/0008-remote-image-display.md) |
| Route construction | typed helpers in `lib/routes/` (B-504) | Provisional | [ADR 0009](docs/adr/0009-typed-route-construction.md) |
| Async query hook | loading + data + error tuple; cleanup on unmount — follow `useAlerts`/`useTopicFollows` pattern | Stable | [ADR 0010](docs/adr/0010-async-query-ownership.md) |
| Motion and post video autoplay | `useReducedMotion()` + visible-only `usePostVideoPlayback()` | Stable | [ADR 0014](docs/adr/0014-reduced-motion-media-playback.md) |

## Domain Ownership

| Domain | Owner |
| --- | --- |
| Route construction | `lib/routes/` |
| API calls + transforms | `lib/services/` |
| Entity typing | `types/domain.ts`, `types/database.ts` |
| Async query orchestration | `lib/hooks/` |
| Reusable presentation | `components/ui/` |
| Cross-feature shared UI | `components/` |
| Feature-local UI and screens | `features/<feature>/` |

## Documentation Rules

Update docs when implementation truth changes:

- Route/folder change → `docs/architecture/ARCHITECTURE.md`, `product/FEATURES.md`, `REPO_MAP.md`
- Security/auth/storage/backend change → `docs/security/SECURITY.md`
- Release/env change → `operations/RELEASE.md`, `operations/BETA.md`
- Product behaviour change → `product/FEATURES.md` + matching product doc
- Ranking/search/feed/analytics change → `product/SEARCH.md`, `product/FEED.md`, or `docs/analytics/ANALYTICS.md`
- Design/component/copy change → `design/DESIGN_SPEC.md`, `design/UI_LIBRARY.md`, or `design/UX_Copywriting_Guide.md`
- Shipped or discovered work → `BACKLOG.md`
- Strategic/product change → `PRODUCT.md`
- Durable architecture/provider/data/security decision → ADR in `docs/adr/`

Docs: concise, operational, easy to scan. No duplicating long strategy essays across files. Extend existing docs first; new docs only when topic needs its own owner. See [docs/GOVERNANCE.md](docs/GOVERNANCE.md) for lifecycle, budgets, and ADR policy.

## Backlog Rules

`BACKLOG.md` is execution truth. Preserve completed items and history. Sequence highest-leverage work top to bottom. Insert discovered work in the right section, not bottom by default.

**7-column schema** (see Column Guide in `BACKLOG.md`): `Status · Priority · ID · Item · Problem · Implementations · Implementation Type`. The Problem cell contains everything an agent needs: problem statement, why it matters, `Depends on: ...`, `Burden: Medium/High` if not Low, `Do: ...` instruction. Never add separate columns or Phase N prose blocks to section headers.

**Backlog hygiene rules** (enforced by `check:backlog-integrity`):

- **Pre-flight/post-flight:** Run `npm run check:backlog-integrity` before starting and after finishing any work on `BACKLOG.md`, `COMPLETED_ITEMS.md`, `backlog-counter.md`, or `worklog.md`. Applies to Claude Code and Codex agents alike.
- **Moving rows:** Use `node scripts/ops/add-completed-item.js --id B-NNN ...` or copy the row byte-for-byte. Never retype or regenerate — formatting errors accumulate fast.
- **Empty sections:** When removing the last data row from a section table, replace the orphaned table header+separator with `_All items shipped — see COMPLETED_ITEMS.md._`
- **`[~]` status:** Only set `[~]` when the Implementations cell contains partial shipped evidence. Never `[~]` with "Not implemented yet."
- **ID insertion order:** `COMPLETED_ITEMS.md` rows must be strictly ascending by ID. Verify the IDs above and below before inserting.
- **No phase plan prose:** Never add `Phase N (label): ...` blocks to section headers.

## AI Rules

- Challenge overengineering and unnecessary AI. Avoid blind confirmation bias.
- Minimise blast radius. Prefer small, reversible changes.
- Keep implementation, docs, and backlog synchronised.
- Prefer actual implementation + docs for backlog/features; docs-only completion valid only when the backlog row explicitly delivers strategy, policy, owner-index, ADR/template, or deferred external/legal work.
- No parallel systems. No turning the master plan into an immediate checklist.
- Keep docs in their owner folders once restructured.
- **Minimise token usage:** Think deeply once; do not repeat analysis. Do not re-read files already in context. State results and decisions directly; no preamble, no trailing summary, no reasoning narration.
- **File reads:** Read files once. `grep` before `Read` for symbol lookups. Use `Read` with `offset`+`limit` on large files; never read a whole file to find one symbol. Prefer `grep`/`find` over spawning Explore agents for single known-path lookups.
- **Check runs:** Run only the checks that match the change (see Required Checks). Do not run `validate:full` unless opening a PR. Pass `--no-coverage` to jest unless coverage is the point.
- Bullet points and short phrases over prose in responses and docs. No repeating context already visible in conversation, file, or tool output.
- **Check `docs/LESSONS.md` first:** Identify relevant topics; read linked `docs/lessons/<topic>.md` files. Directory is navigation only; do not treat it as lesson content.
- **Parallel agents for broad audits:** Up to 3 parallel Explore agents for tasks spanning multiple areas. Stop once sufficient context is obtained; do not scan the full repo unless scope is genuinely unknown.
- **Bug class prevention:** Fix includes: (1) root cause, (2) similar risk areas, (3) preventative check or guardrail. Fix without check is incomplete.
- **Regression-first bug fixes:** Write/update a failing test before writing the fix. Test is the check; fix makes it pass. Skip only if failure mode is impossible to exercise — document why.
- **Update topic lessons after bug fixes:** Append lesson to `docs/lessons/<topic>.md`. Update `docs/LESSONS.md` only when adding/renaming/reclassifying a topic.
- **Never use `as unknown as`:** Treat as equivalent to `as any`. Use typed RPC wrappers, generated `Database` types, or `unknown` + guard functions. Caught by `check:unsafe-any`.
- **Check Canonical Patterns before implementing.** Extend in place; never add a variant. Multiple existing implementations → consolidate, not add another.
- **Complexity is a review signal, not a split trigger:** 200-LOC hooks and 400-LOC screens signal cohesion review — not automatic split. Extract only clearly distinct concerns.
- **Do not touch `StepMedia.tsx` during stabilisation** unless the task explicitly requires modifying adjacent logic. Tracked in B-506.
- **Search location relevance:** Geo-ranked DB queries must always pass `near_lat`/`near_lng`. Google Places Autocomplete in local-first contexts: use `strictbounds=true` with metro-scale radius (50km). Distance scoring must penalise far results (> 50km → ×0.15 multiplier), not only boost nearby. See `docs/lessons/search.md`.
- **Common AI failure modes:** over-abstraction, duplicate patterns, excessive file splitting, unsafe type bypasses (`as any`, `as unknown as`, `!`), unnecessary rewrites, dependency overuse, solving a local problem while harming global consistency.
- **Review Flow UX Gate:** For any change to create-post flow, evaluate: (1) cognitive load — max 3–4 choices per section; (2) empty state — fact + next action; (3) CTA clarity — one dominant primary action; (4) information hierarchy — key recommendation above fold; (5) product differentiation — dish-first; (6) Must Order visible without scrolling on Review step; (7) a11y — all touch targets ≥ 44pt, descriptive labels; (8) completion friction — min taps to post; (9) form fatigue — optional details collapsed by default. Run `design/REVIEW_FLOW_CHECKLIST.md`.

## Pre-Merge Review Checklist

- New pattern introduced without updating Canonical Patterns table?
- Increased regression surface (new variant, new optional behaviour)?
- Duplicated logic that already exists elsewhere?
- Added implicit behaviour (optional prop altering flow, hidden fallback)?
- Hidden coupling between features?
- Another source of truth for existing state?
- Bypassed type safety (`as any`, `as unknown as`, `!`)?
- Abstraction added without proven multiple stable use-cases?
- New dependency without justification?
- Untracked temporary code (TODO/FIXME without B-### ID)?
- UI/interaction change tested on Android, not just iOS?
- Touches data collection, auth, notifications, location, provider APIs, or analytics? Compliance Impact review done and `COMPLIANCE.md` updated?
- New DB queries: `.limit()` + index justification? Backfills > 10k rows: staged plan?

## AI Execution Command Standards

Shape for major backlog items:

`Problem: <why this matters>. Do: <specific smallest useful step>. Verify dependencies (<docs/services/tables>), operational burden (<Low/Medium/High>), related docs (<paths>), and update BACKLOG.md when shipped or scope changes.`

Good commands: name the product/operational problem; point to source-of-truth docs and implementation boundaries; ask for smallest reversible step; include expected docs/backlog updates; include matching checks; state delivery shape (code, migration, automation, guardrail, docs-only, or Roy-owned external action). As short as possible while retaining actionable precision.

When a backlog command is vague, inspect `PRODUCT.md`, `BACKLOG.md`, `AGENTS.md`, [docs/GOVERNANCE.md](docs/GOVERNANCE.md), and the nearest owner doc before editing code.

## Required Checks

- `npm run check:hygiene` (includes ratcheted hidden-risk and feature-flag checks)
- `npm run check:docs`
- `npm run check:platform`
- `npm run typecheck`
- `npm run check:release`
- `npm run check:search` — Google Places integration, geo-ranking, or location-bias changes
- `npm run check:coordination` — coordination files, backlog IDs, or worklog claims
- `npm run lint` — TypeScript/React Native code
- `npm run check:unsafe-any` — TypeScript/React Native code
- `npm run test:type-safety` — parsing, route params, provider guards, scanners, or Edge Function guards
- `npm run check:supabase-types` — migrations, RPCs, or `types/database.ts`
- `npm run check:audit` — adding or modifying entity domains with mutable state
- `npm run check:circular-deps` — changing imports or splitting files
- `npm run check:risk-guardrails` — async fallback, side-effect, shared-file, import, or debt-marker behaviour
- `npm run check:stale-flags` — adding, changing, or removing feature flags
- `npm run check:tokens` — any styling in `features/` or `components/`
- `npm run check:darkmode` — any colour, background, or overlay value
- `npm run check:a11y` — adding or modifying any interactive element
- `npm run check:architecture` — code in `features/`, `lib/hooks/`, `components/`, or `lib/services/`
- `npm run check:schema-drift` — after editing any file in `supabase/schema/` (already in hygiene chain)

Run `npm run validate` before committing. Run `npm run validate:full` before opening a PR.

## Database Architecture

### Schema change workflow

1. Edit the relevant file in `supabase/schema/<domain>/` — use `docs/database/schema-index.json` (`owners` map) to locate the correct file instantly.
2. Update the `-- Owned tables:` line in the file's ownership header (single line, comma-separated).
3. Run `./scripts/build-schema.sh > supabase/schema.sql` — this also regenerates `docs/database/schema-index.json`.
4. Run `supabase db diff --use-migra -f <migration_name>` to generate migration.
5. Review the generated migration — fix if wrong.
6. Run `supabase migration up --include-all` (local).
7. Run `npm run check:schema` — must pass before PR.
8. Run `npm run check:supabase-types`.

**Never edit `supabase/schema.sql` directly.** Never edit generated migrations (data migrations are the only exception).

**Schema-migration pairing rule:** Any migration introducing `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `CREATE TYPE`, `CREATE FUNCTION`, or `CREATE VIEW` must modify the corresponding `supabase/schema/` domain file AND rebuild `schema-index.json` in the same PR. Enforced by `check:schema-completeness`.

### Governance rules

- **No new root-level schema files.** All tables go inside a domain subdirectory. `supabase/schema/new_feature.sql` is never allowed.
- **No global triggers file.** Triggers live in `functions/<domain>.sql` next to the functions they invoke.
- **`schema.sql` is generated and committed.** Never gitignore it; never edit it by hand. Regenerate by running `scripts/build-schema.sh`.
- **Split domain subdirectories at ~200 lines.** Create `places/`, `posts/`, etc. proactively.
- **Every table must have a DATA_DICTIONARY entry** (`supabase/schema/DATA_DICTIONARY.md`).
- **No new enums without ADR review.** Enums become schema debt when values change. Prefer `text` columns with `CHECK` constraints or lookup tables.
- **No JSONB without inline comment** explaining why structure is genuinely unknown at design time.
- **Soft-delete all recoverable user-generated content** (`deleted_at`). Posts, comments, collections, dishes. Places: `place_status` + `deleted_at`.
- **Every FK must have an index** on the referencing column. Enforced by `check:fk-indexes`; add intentional exceptions to `scripts/check-fk-indexes.ignore.json`.
- **`schema-index.json` is the AI routing surface.** Use `docs/database/schema-index.json` `owners` map to locate the correct domain file for any table — O(1) lookup, no SQL parsing needed. See `docs/database/SCHEMA_ARCHITECTURE.md` for full guide.

### Architecture Invariants

Never violate these without an ADR:

1. **Core entities stay small.** `places` and `users` must not accumulate analytics, search signals, or provider payloads as columns.
2. **Derived data is not stored in source-of-truth tables.** Scores, search ranks, and popularity signals live in their own tables.
3. **Search tables must be rebuildable.** Document source tables and rebuild procedure in DATA_DICTIONARY.
4. **Analytics tables must be rebuildable.** Same rule.
5. **Provider data stays isolated.** `place_provider_cache` / `place_observations` never feed columns directly into `places`.
6. **No new root-level schema files.**
7. **No cross-domain function dependencies without ADR.**
8. **No JSONB without inline comment** justifying why structure is genuinely unknown.
9. **No new enums without ADR review.**
10. **Every table must have a DATA_DICTIONARY owner.**
