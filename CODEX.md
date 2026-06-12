# CODEX.md

Use [AGENTS.md](AGENTS.md) as the canonical AI/operator guide.

Codex-specific reminders:

- Keep responses concise.
- Minimize unrelated repo scanning.
- Preserve existing architecture and behavior unless the task explicitly changes them.
- Do not introduce new dependencies, broad rewrites, or parallel systems without explicit approval.
- Never silence TypeScript with `as any`, `@ts-ignore`, `@ts-nocheck`, or eslint disables; explained `@ts-expect-error` is exceptional. Use `unknown`, guards, generated Supabase types, and typed wrappers.
- Avoid non-null assertions and empty catches in runtime code; narrow values and document intentional fallbacks.
- Follow the Multi-Agent Coordination protocol in AGENTS.md exactly: claim files in `worklog.md` before editing, reserve backlog IDs in `backlog-counter.md`, stop and report on conflict.
- Run `npm run check:coordination` before finishing any task that touches coordination files.

## End-of-task checklist (required before finishing any implementation)

After completing any code change, do all of the following that apply:

**BACKLOG.md** — mark shipped items done; insert newly discovered work in the right section (not bottom by default); update scope or dependencies if they changed.

**Docs** — follow the Documentation Rules in AGENTS.md exactly:

- Route/folder change → `docs/architecture/ARCHITECTURE.md`, `REPO_MAP.md`
- Security/auth/storage/backend change → `docs/security/SECURITY.md`
- Release/env change → `operations/RELEASE.md`
- Product behavior change → `product/FEATURES.md` and the matching product doc
- Ranking/search/feed/analytics change → `product/SEARCH.md`, `product/FEED.md`, or `docs/analytics/ANALYTICS.md`
- Design/component/copy change → `design/DESIGN_SPEC.md` or `design/UX_Copywriting_Guide.md`
- Durable architecture/provider/data/security decision → add an ADR in `docs/adr/`

**Checks** — run the checks that match the change (see AGENTS.md Required Checks).

Use `npm run validate` for normal implementation passes and `npm run validate:full` before PR-ready handoff.

**Learning** — use `docs/LESSONS.md` to choose the relevant topic file, then record non-obvious decisions, tradeoffs, or gotchas in `docs/lessons/<topic>.md`. Change the directory only when adding, renaming, or reclassifying a topic.
