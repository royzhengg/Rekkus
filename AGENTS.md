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
- **Service boundary:** Never import `supabase` directly in `features/` or `app/`. All DB and API calls go through `lib/services/`. Known violations (PostDetailScreen, CreateGroupScreen, EditProfileScreen) are tracked in `backlog_new.md` ARCH-001–003 and must be fixed before new features are added to those screens.
- **No `as any`:** Do not cast Supabase calls or any other expression to `any`. Create typed wrapper functions in the relevant `lib/services/` file using the generated `types/database.ts` types. The ESLint rule `@typescript-eslint/no-explicit-any` is enforced in `features/` and `lib/services/`.
- **God component prevention:** Feature screens must stay under 400 LOC; hooks under 200 LOC. If a file exceeds this, extract components or split the hook before adding more logic. `check:architecture` enforces the 600 LOC hard limit and will fail CI.
- **Animation token adoption:** Do not add constants to `lib/animations.ts` without implementing them in the same PR. Unused animation tokens are deleted, not left as aspirational comments.

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
- **Check `docs/LESSONS.md` first:** Before starting any task, scan LESSONS.md for prior learnings on the same topic. Apply them directly — do not re-derive what is already known.
- **Parallel agents for broad audits:** Use up to 3 parallel Explore agents for tasks spanning multiple areas of the codebase. Stop searching once sufficient context is obtained; do not scan the full repo unless scope is genuinely unknown.
- **Bug class prevention:** When fixing a bug, identify (1) root cause, (2) similar risk areas, (3) a preventative check or guardrail. Implement the check before closing the task. A fix without a check is incomplete.
- **Update LESSONS.md after bug fixes:** After fixing any bug class or making a non-obvious architecture decision, append the lesson to `docs/LESSONS.md` and verify the corresponding AGENTS.md rule covers the pattern. This is part of the definition of done.
- **Minimise token usage:** Think deeply once; do not repeat analysis. Do not re-read files already in context. Do not narrate reasoning — state results and decisions directly.

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

- `npm run check:hygiene`
- `npm run check:docs`
- `npm run check:platform`
- `npm run typecheck`
- `npm run check:release`
- `npm run lint` when touching TypeScript/React Native code
- `npm run check:tokens` when touching any styling in `features/` or `components/`
- `npm run check:darkmode` when adding any color, background, or overlay value
- `npm run check:a11y` when adding or modifying any interactive element
- `npm run check:architecture` when adding code to `features/` (enforces file size + service boundary)

Run `npm run validate` (typecheck + lint + tokens + darkmode) before committing. Run `npm run validate:full` before opening a PR.
