# Unsafe Typing Follow-Up Review Note

Task-owned changes in this follow-up:

- Type-safety test lane: `scripts/test-type-safety.js`, `tests/type-safety/*`
- Unsafe scanner fixtureability: `scripts/lib/unsafe-any-rules.js`, `scripts/check-unsafe-any.js`
- Pure provider/moderation guards: `lib/services/googlePlacesGuards.ts`, `lib/services/moderationGuards.ts`
- Edge Function guard extraction: `supabase/functions/_shared/guards.ts`, plus imports in `send-push`, `embed-content`, and `moderate-content`
- Local/CI guardrails: `.husky/pre-commit`, `scripts/check-supabase-types.js`, `package.json`, `.github/workflows/ops-checks.yml`, `scripts/check-ci-coverage.js`
- Operator docs/backlog: `AGENTS.md`, `CLAUDE.md`, `docs/LESSONS.md`, `docs/lessons/architecture.md`, `docs/lessons/utilities.md`, `BACKLOG.md`

Dirty-worktree note:

- The repo had broad pre-existing modified files before this follow-up.
- Do not stage or review unrelated lint/import-order/floating-promise churn as part of this unsafe-typing follow-up.
- One small unrelated TypeScript import typo in `features/search/SearchScreen.tsx` was fixed because it blocked `typecheck`.
