# Rekkus Agent Guide

This is the canonical AI/operator guide for Rekkus. Use it before `CLAUDE.md`.

## Authority Order

1. `PRODUCT.md` — strategic product truth.
2. `BACKLOG.md` — execution order and operational roadmap.
3. `AGENTS.md` — AI/operator behavior.
4. Specialized docs — domain truth for architecture, security, release, product behavior, design, analytics, and UI.

When docs conflict, prefer the most specific doc inside that authority order and update stale docs as part of the work.

## Product Direction

Build Rekkus as a dish-first social taste graph and hyperlocal food discovery utility.

Do not turn Rekkus into:

- a generic restaurant directory
- a generic review platform
- a maps clone
- an AI chatbot app
- an influencer-first social feed

Prioritize content density, saves, collections, dish graph, taste graph, local discovery, and then monetization.

## Execution Principles

- Work incrementally; avoid giant rewrites.
- Prefer deterministic systems before AI.
- Prefer local DB first, Google fallback second.
- Prefer boring, observable automation over hidden magic.
- Keep operational burden low.
- Preserve user-facing behavior unless explicitly changing it.
- Reuse existing components, hooks, services, utilities, and docs before creating new ones.
- Avoid new dependencies unless the value clearly beats maintenance, bundle, and security cost.
- Make risky behavior reversible with flags, rollbacks, or additive migrations.

Default priority order:

1. Stability
2. Simplicity
3. UX clarity
4. Operational visibility
5. Cost efficiency
6. Performance
7. Feature velocity
8. Abstraction

## Repo Rules

- `app/`: Expo Router wrappers only.
- `features/`: screen implementations and feature-local components.
- `components/ui/`: reusable primitives with no business logic.
- `components/`: cross-feature shared UI.
- `lib/services/`: Supabase, Google, Expo, and network calls.
- `lib/hooks/`: reusable hooks.
- `lib/contexts/`: React providers.
- `lib/mocks/`: mock/demo data only.
- `types/domain.ts`: app-facing domain types.
- `types/database.ts`: generated Supabase types only.

Never import `lib/mocks` directly from `app/` or `features/`; route through data-source boundaries.

## Engineering Rules

- Use `useThemeColors()` and memoized styles for themed UI.
- Keep colors, spacing, and typography aligned with existing constants.
- Put reusable icons in `components/icons.tsx`; do not inline screen-local SVGs.
- Use `RekkusActionSheet` for choice/action lists; avoid `ActionSheetIOS`.
- Put external calls behind services; do not add direct Google/Supabase logic to screens unless no service exists and the task is creating one.
- Gate authenticated writes with auth checks, but rely on Supabase RLS for authorization.
- Keep service-role secrets only in Supabase Edge Functions.
- Keep public `EXPO_PUBLIC_*` values free of private secrets.
- **Cache-first, API-last:** Before calling any paid external API (Google Places, geocoding, etc.), check if the data already exists in the DB. After calling it, store the result with an appropriate TTL (Google Places: 30-day per ToS; public reference data: indefinite). Every new external API integration must implement this pattern. See `restaurant_provider_cache` as the reference implementation and `lib/utils/locationResolver.ts` for the geocoding feedback loop.
- **Token enforcement:** Never hardcode hex colors, pixel spacing, or font sizes in `features/`. Import from `constants/Colors.ts` (via `useThemeColors()`), `constants/Spacing.ts`, and `constants/Typography.ts`. Run `check:tokens` and `check:darkmode` before committing any styling change.
- **Touch targets:** All interactive elements must have a minimum hit area of 44×44pt per Apple HIG. Use the `<IconButton>` primitive (`components/ui/IconButton.tsx`) — never a raw `TouchableOpacity` with `width`/`height` < 44.
- **Service boundary:** Never import `supabase` or Supabase provider types directly in `app/`, `features/`, `lib/hooks/`, or `lib/contexts/`. All DB, auth, and API calls go through `lib/services/`; hooks and contexts compose typed service contracts. `check:architecture` and ESLint enforce this boundary.
- **No unsafe typing:** Never use `as any`, `: any`, `@ts-ignore`, `@ts-nocheck`, eslint disables, or `as unknown as <Type>` to silence type errors. `as unknown as` bypasses narrowing as effectively as `as any`. `@ts-expect-error` requires an inline reason and should be exceptional. Prefer `unknown`, type guards, generated Supabase types, and typed service wrappers. External JSON, storage payloads, route params, and JSONB metadata must be narrowed before use. `check:unsafe-any`, strict TypeScript flags, and ESLint enforce this across app-facing and shared runtime code.
- **No asserted runtime assumptions:** Avoid non-null assertions in app/runtime code; narrow optional state, route params, and provider data before use. Do not leave empty catches: surface user-facing failures, emit a privacy-safe signal, or document an intentional non-blocking fallback. `check:risk-guardrails` and ESLint enforce new violations.
- **Async safety:** Await work that determines behavior. Mark intentional background work with `void` only when the callee handles/reports failures. Fatal promise and hook-dependency lint is active; do not suppress it.
- **Async regression protection:** Debounced async hooks must invalidate active work before early returns and on cleanup; shared route, search-transform, service, and hook paths require behavioural tests with per-module coverage ratchets. `test:unit`, `check:coverage`, and `check:risk-guardrails` enforce this.
- **God component prevention:** Treat 400-LOC feature screens and 200-LOC hooks as complexity review thresholds — not automatic split requirements. A cohesive 250-LOC hook is better than 4 fragmented abstractions. Review cohesion when the threshold is crossed; extract a clearly distinct concern rather than splitting lines. `check:architecture` fails new oversized shared files and requires backlog-linked allowlists for existing shared debt.
- **Circular dependencies:** Keep shared types/constants in neutral files instead of importing from screens. `check:circular-deps` fails on source import cycles.
- **Predictable imports and debt:** Use `@/` rather than three-or-more-level relative imports. New `TODO`, `FIXME`, or `HACK` comments require a `B-###` backlog ID. Feature flags need an owner/review date and newly unreferenced flags fail `check:stale-flags`.
- **Animation token adoption:** Do not add constants to `lib/animations.ts` without implementing them in the same PR. Unused animation tokens are deleted, not left as aspirational comments.
- **Shared component discipline:** Components in `components/` and `components/ui/` must remain presentation-focused. Small local UI interaction state is acceptable. Do not embed cross-feature business orchestration, navigation ownership, fetch logic, or mutation logic inside reusable UI primitives. Navigation ownership belongs to feature screens, route coordinators, or typed route helpers — never shared UI components.
- **Async ownership:** Async orchestration belongs in hooks or services — not in presentation components. Components receive data, loading state, and error state as props or from a hook. Retry logic, cancellation, and sequencing belong in `lib/hooks/` or `lib/services/`.
- **Reduce variance:** Before implementing any pattern (loading, error, modal, navigation, async query), check the Canonical Patterns table below. Extend the existing canonical rather than creating a variant. One consistent pattern beats multiple clever patterns. Finding 3 existing implementations is a reason to consolidate — not to add a 4th.
- **Delete before add:** Before introducing a new helper, abstraction, or utility, first evaluate whether an existing one can be extended or an obsolete one removed. Accumulation of legacy variants compounds regression surface area.
- **Explicit over implicit:** Avoid optional props that silently alter component behaviour, inferred entity types, hidden fallback branches, and overloaded components. Shared abstractions must be predictable without reading their implementation.
- **No premature generic systems:** Do not create "universal" abstractions unless multiple stable, concrete use-cases already exist. Prefer concrete implementations first; extract only when duplication is proven and the abstraction boundary is clear.
- **No cross-feature leakage:** Features must not depend on internal implementation details of other features. Shared contracts belong in `lib/`, `types/`, or shared layers. If two features need the same logic, extract it — do not import across feature boundaries.
- **State ownership:** One owner per piece of state. Do not independently store derived state — it becomes stale. Pass down or lift up rather than duplicate.
- **Runtime validation scope:** Use lightweight runtime validation ONLY at unstable external/provider boundaries and persisted cache boundaries (Supabase RPC responses, Google Places payloads, AsyncStorage reads). Trust TypeScript for internal code.
- **Shared abstraction modification rules:** Before modifying a shared component, hook, or service with multiple consumers — identify all consumers, assess regression surface, and prefer additive changes over behavioural changes. When a breaking change is unavoidable, update all consumers atomically.
- **Temporary code governance:** TODOs, FIXMEs, and transitional wrappers must include a reason, a removal condition, and a linked backlog ID (B-###). Anonymous debt accumulation is not allowed. Caught by `check:risk-guardrails`.
- **Safe refactor conditions:** Refactors are encouraged when adjacent logic is already changing, regression surface is small, duplication is clearly harmful, and practical verification exists. Refactors are blocked when files are large, have no tests, or are shared across many consumers.
- **Dependency governance:** New dependencies require a problem justification, comparison against the existing stack, maintenance and security review, bundle/runtime impact assessment, and overlap analysis. Avoid adding packages for problems solvable with existing tools.
- **Audit coverage:** Every new entity domain with mutable state must ship an audit table (append-only, `FOR ALL USING (false)` RLS, no retention deletion) in the same migration and add it to `platform_audit_events_view` in that same migration. Write audit records via a `SECURITY DEFINER` RPC only — never direct client INSERT. Deletion audit records must use no FK or `ON DELETE SET NULL` — never `ON DELETE CASCADE` — so the record survives entity deletion. The `check:audit` guardrail enforces view completeness at CI time and will fail if a new audit table is absent from the view. See ADR 0011.
- **Performance philosophy:** Prefer correctness and consistency over premature optimisation. Optimise only after identifying real bottlenecks. Avoid speculative `useMemo`, `useCallback`, and `memo` wrappers — they add complexity and introduce stale closure risk.
- **Data shape governance:** External and provider payloads must be normalised at service boundaries. Do not leak provider-specific shapes (Google Places, Supabase raw types) throughout the app. Normalise in `lib/services/`; components receive domain types from `types/domain.ts`.
- **Regression surface awareness:** Every new variant, abstraction, or optional behaviour increases regression surface area. Before adding, ask: does this reduce or increase the number of places that can break? Prefer fewer, stable, well-understood paths.

## Canonical Patterns

When implementing any of the following, use the listed canonical. Do not create a new variant. Extend the canonical if it needs improvement. Do not replace a canonical without updating this table and documenting why the old one is no longer preferred.

Pattern lifecycles: **Stable** (use this) | **Provisional** (usable, subject to change) | **Deprecated** (do not extend — migrate away) | **Legacy** (exists, will not be migrated)

Deprecation workflow: mark deprecated → block new usage → migrate incrementally → remove once all consumers migrated.

| Pattern | Canonical | State | Decision |
| --- | --- | --- | --- |
| Loading state (action / pagination) | `ActivityIndicator` from RN with a theme token | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Loading state (content-shaped) | `<Skeleton>` / `<SkeletonText>` matching the eventual surface | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Loading state (blocking full-screen, no meaningful shape) | `<EmptyState loading>` | Stable | [ADR 0005](docs/adr/0005-contextual-loading-surfaces.md) |
| Error display | `<ErrorMessage>` (`components/ui/ErrorMessage.tsx`); no inline failure text, failure alerts, or dismiss-only failure sheets | Stable | [ADR 0006](docs/adr/0006-routine-and-actionable-failures.md) |
| Actionable failure recovery | `<RekkusActionSheet>` only when it offers a recovery action such as retry/review | Stable | [ADR 0006](docs/adr/0006-routine-and-actionable-failures.md) |
| Modal / choice sheet | `<RekkusActionSheet>` (`components/ui/RekkusActionSheet.tsx`) | Stable | [ADR 0007](docs/adr/0007-in-app-choice-surfaces.md) |
| Image display | `<CachedImage>` (`components/ui/CachedImage.tsx`) | Stable | [ADR 0008](docs/adr/0008-remote-image-display.md) |
| Route construction | typed helpers in `lib/routes/` (B-504) | Provisional | [ADR 0009](docs/adr/0009-typed-route-construction.md) |
| Async query hook | loading + data + error tuple; cleanup on unmount — follow `useAlerts` / `useTopicFollows` pattern | Stable | [ADR 0010](docs/adr/0010-async-query-ownership.md) |

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

Update docs whenever implementation truth changes:

- Route/folder change: `docs/architecture/ARCHITECTURE.md`, `product/FEATURES.md`, `REPO_MAP.md`
- Security/auth/storage/backend change: `docs/security/SECURITY.md`
- Release/env change: `operations/RELEASE.md`, `operations/BETA.md`
- Product behavior change: `product/FEATURES.md` and the matching product doc
- Ranking/search/feed/analytics change: `product/SEARCH.md`, `product/FEED.md`, or `docs/analytics/ANALYTICS.md`
- Design/component/copy change: `design/DESIGN_SPEC.md`, `design/UI_LIBRARY.md`, or `design/UX_Copywriting_Guide.md`
- Shipped or discovered work: `BACKLOG.md`
- Strategic/product positioning change: `PRODUCT.md`
- Durable architecture/provider/data/security decision: add an ADR in `docs/adr/`

Docs should be concise, operational, and easy for agents to scan. Avoid duplicating long strategy essays across files.

Documentation maintenance is automatic for meaningful changes: if code, routes, workflows, APIs, product behavior, release flow, or security posture changes, update the relevant docs before finishing the task. Extend existing docs first; create new docs only when the topic needs its own owner.

Use [docs/GOVERNANCE.md](docs/GOVERNANCE.md) for documentation lifecycle, budgets, and ADR policy.

## Backlog Rules

`BACKLOG.md` is execution truth.

- Preserve completed items and historical context.
- Sequence highest-leverage work top to bottom.
- Insert discovered work in the right section, not at the bottom by default.
- Track technical debt, operational debt, security, infrastructure, observability, automation, growth, restaurant platform, admin platform, and experiments separately.
- Major items should explain why they matter, dependencies, burden, and a suggested AI command when useful.

## AI Rules

- Challenge overengineering and unnecessary AI.
- Avoid blind confirmation bias.
- Minimize blast radius.
- Prefer small, reversible changes.
- Keep implementation, docs, and backlog synchronized.
- Prefer actual implementation plus docs for backlog/features; docs-only completion is valid only when the backlog row explicitly delivers strategy, policy, owner-index, ADR/template, or deferred external/legal work.
- Do not create parallel systems.
- Do not turn the master plan into an immediate checklist.
- Keep docs in their owner folders once a restructure pass creates them.
- Use the minimum words needed. Omit preamble, filler, and summaries the reader can derive from the diff or output.
- Prefer bullet points and short phrases over prose paragraphs in responses and docs.
- Do not repeat context already visible in the conversation, file, or tool output.
- Skip trailing summaries ("Here's what I did…") unless the user asks.
- Scan only files relevant to the task; do not read or cat unrelated files.
- **Check `docs/LESSONS.md` first:** Before starting any task, read the LESSONS.md index to identify relevant lessons. Open the linked topic file in `docs/lessons/` only when the task touches that area — do not re-derive what is already known.
- **Parallel agents for broad audits:** Use up to 3 parallel Explore agents for tasks spanning multiple areas of the codebase. Stop searching once sufficient context is obtained; do not scan the full repo unless scope is genuinely unknown.
- **Bug class prevention:** When fixing a bug, identify (1) root cause, (2) similar risk areas, (3) a preventative check or guardrail. Implement the check before closing the task. A fix without a check is incomplete.
- **Update LESSONS.md after bug fixes:** After fixing any bug class or making a non-obvious architecture decision, append the lesson to the relevant `docs/lessons/<topic>.md` file and add/update the one-liner in the `docs/LESSONS.md` index. Verify the corresponding AGENTS.md rule covers the pattern. This is part of the definition of done.
- **Minimise token usage:** Think deeply once; do not repeat analysis. Do not re-read files already in context. Do not narrate reasoning — state results and decisions directly.
- **Never use `as unknown as`:** Treat it as equivalent to `as any`. Use typed RPC wrappers, generated `Database` types, or `unknown` + guard functions instead. Caught by `check:unsafe-any`.
- **Check Canonical Patterns before implementing:** Use the pattern in the table above. If it needs extension, extend it in place — do not create a new variant. Finding multiple existing implementations is a reason to consolidate, not to add another.
- **Complexity is a review signal, not a split trigger:** 200-LOC hooks and 400-LOC feature screens signal a cohesion review — not an automatic split. A 250-LOC cohesive hook is better than 4 fragmented 70-LOC abstractions. Extract when there is a clearly distinct concern, not merely many lines.
- **Do not touch `StepMedia.tsx` during stabilisation** unless the task explicitly requires modifying adjacent logic. It is tracked in B-506.
- **Regression surface awareness:** Before adding a pattern, abstraction, or optional behaviour — ask whether it consolidates or expands the surface area of things that can break. Prefer consolidation.
- **Common AI failure modes to avoid:** over-abstraction, duplicate patterns, excessive file splitting, unsafe type bypasses (`as any`, `as unknown as`, `!`), unnecessary rewrites, dependency overuse, solving a local problem while harming global consistency.

## Pre-Merge Review Checklist

Before finishing any implementation, verify:

- Did this introduce a new pattern without updating the Canonical Patterns table?
- Did this increase regression surface area (new variant, new optional behaviour)?
- Did this duplicate logic that already exists elsewhere?
- Did this add implicit behaviour (optional prop altering flow, hidden fallback)?
- Did this add hidden coupling between features?
- Did this create another source of truth for existing state?
- Did this bypass type safety (`as any`, `as unknown as`, `!`)?
- Did this add an abstraction without proven multiple stable use-cases?
- Did this add a new dependency without justification?
- Did this leave untracked temporary code (TODO/FIXME without B-### ID)?

## AI Execution Command Standards

Backlog `Suggested AI Command` entries should give agents enough context to execute without rediscovering ownership from scratch.

Use this shape for major items:

`Problem: <why this matters>. Do: <specific smallest useful step>. Verify dependencies (<docs/services/tables>), operational burden (<Low/Medium/High>), related docs (<paths>), and update BACKLOG.md when shipped or scope changes.`

Good commands should:

- Name the product or operational problem, not just the task.
- Point to the source-of-truth docs and implementation boundaries.
- Ask for the smallest reversible step.
- Include expected docs/backlog updates.
- Include the checks that match the change.
- State the expected delivery shape: code, migration, automation, guardrail, docs-only, or Roy-owned external action.
- Avoid asking agents to implement broad master-plan sections all at once.
- Be as short as possible while retaining actionable precision — omit filler phrases.

When a backlog command is vague, inspect `PRODUCT.md`, `BACKLOG.md`, `AGENTS.md`, [docs/GOVERNANCE.md](docs/GOVERNANCE.md), and the nearest owner doc before editing code.

## Required Checks

Use the checks that match the change:

- `npm run check:hygiene` (includes ratcheted hidden-risk and feature-flag checks)
- `npm run check:docs`
- `npm run check:platform`
- `npm run typecheck`
- `npm run check:release`
- `npm run lint` when touching TypeScript/React Native code
- `npm run check:unsafe-any` when touching TypeScript/React Native code
- `npm run test:type-safety` when touching parsing, route params, provider guards, scanners, or Edge Function guards
- `npm run check:supabase-types` when touching migrations, RPCs, or `types/database.ts`
- `npm run check:circular-deps` when changing imports or splitting files
- `npm run check:risk-guardrails` when changing async fallback, side-effect, shared-file, import, or debt-marker behavior
- `npm run check:stale-flags` when adding, changing, or removing feature flags
- `npm run check:tokens` when touching any styling in `features/` or `components/`
- `npm run check:darkmode` when adding any color, background, or overlay value
- `npm run check:a11y` when adding or modifying any interactive element
- `npm run check:architecture` when adding code to `features/`, `lib/hooks/`, `components/`, or `lib/services/` (enforces size ratchets + service boundary)

Run `npm run validate` (typecheck + lint + token and dark-mode checks) before committing. Run `npm run validate:full` before opening a PR.
