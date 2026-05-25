# Contributing

Use this file as the repo hygiene checklist before and after changes.

## Workflow

- Keep changes scoped to the requested feature or fix.
- Preserve behavior unless the task explicitly changes it.
- Move code in small passes and run targeted checks after each major move.
- Update docs in the same change when routes, data flow, security behavior, ranking, or UI primitives change.
- Keep implementation truth, docs truth, and backlog truth synchronized when meaningful behavior or priorities change.

## Operating Truth

- `PRODUCT.md`: strategic product truth.
- `BACKLOG.md`: execution truth and priority order.
- `AGENTS.md`: AI/operator behavior truth.
- `AI_RULES.md`: AI usage philosophy and constraints.
- Specialized docs: domain truth for architecture, release, security, product behavior, design, analytics, and UI.
- `REPO_MAP.md`: quickest way to find ownership boundaries.

## Placement Rules

- `app/`: Expo Router wrappers only.
- `features/`: screen implementations and feature-local components.
- `components/ui/`: reusable primitives with no business logic.
- `components/`: app components reused by multiple features.
- `lib/services/`: Supabase, Google, Expo, and network calls.
- `lib/hooks/`: cross-feature reusable hooks.
- `lib/contexts/`: React providers.
- `lib/mocks/`: mock/demo data only.
- `types/domain.ts`: app-facing domain types.
- `types/database.ts`: generated Supabase types only.

## Non-Regression Checklist

- No UI redesign mixed into structural refactors.
- Old route redirects still work during migrations.
- No mock data appears in beta/production paths.
- No direct `lib/mocks` imports from `app/` or `features/`.
- No `.DS_Store`, duplicate `* 2*` / `* 3*` files, or stray local artifacts.
- No `ActionSheetIOS` in active app code; use `RekkusActionSheet`.
- No service-role secrets outside `supabase/functions`.

## Required Checks

Run the checks that match the change:

- Pre-commit correctness: `npm run validate`
- PR/full-system readiness: `npm run validate:full`
- Platform/native/config: `npm run check:platform`
- File hygiene/security boundaries: `npm run check:hygiene`
- Markdown links: `npm run check:docs`
- App TypeScript: `npm run typecheck`
- Release readiness: `npm run check:release`
- Automation currency: `npm run check:automation`
- Performance guardrails: `npm run check:performance`

## Docs Update Rules

- Route/folder change: update `docs/architecture/ARCHITECTURE.md` and `product/FEATURES.md`.
- Security/auth/storage/backend change: update `docs/security/SECURITY.md`.
- Release/env change: update `operations/RELEASE.md` and `operations/BETA.md`.
- Product behavior change: update `product/FEATURES.md` and the matching product doc.
- Ranking/search/feed/analytics change: update `product/SEARCH.md`, `product/FEED.md`, or `docs/analytics/ANALYTICS.md`.
- Design/component/copy change: update `design/DESIGN_SPEC.md`, `design/UI_LIBRARY.md`, or `design/UX_Copywriting_Guide.md`.
- Shipped feature/backlog change: update `product/FEATURES.md` and `BACKLOG.md`.
- Strategic/product positioning change: update `PRODUCT.md`.
- New ownership boundary or major system: update `REPO_MAP.md`.

## Documentation Lifecycle

- `active`: current source of truth.
- `deprecated`: still useful but no longer authoritative.
- `superseded`: replaced by another doc; link to the replacement.
- `archived`: retained for history only.

Prefer updating active docs over adding new files. New markdown belongs in an owner folder unless it is a root authority doc.
