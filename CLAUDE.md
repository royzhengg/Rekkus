# CLAUDE.md

Canonical guide: [AGENTS.md](AGENTS.md). Run `test:type-safety` after changing unsafe-input guards, provider parsing, scanner rules, or Edge Function payload guards.

## End-of-task checklist

**BACKLOG.md** — mark shipped done; insert discovered work in right section; update scope/dependencies.

**Docs** (follow AGENTS.md Documentation Rules):
- Route/folder change → `docs/architecture/ARCHITECTURE.md`, `REPO_MAP.md`
- Security/auth/storage/backend → `docs/security/SECURITY.md`
- Release/env → `operations/RELEASE.md`
- Product behaviour → `product/FEATURES.md` + matching product doc
- Ranking/search/feed/analytics → `product/SEARCH.md`, `product/FEED.md`, or `docs/analytics/ANALYTICS.md`
- Design/component/copy → `design/DESIGN_SPEC.md` or `design/UX_Copywriting_Guide.md`
- Durable architecture/provider/data/security decision → ADR in `docs/adr/`

**Checks** — run checks matching the change (see AGENTS.md Required Checks). `npm run validate` for normal passes; `npm run validate:full` before PR handoff.

**Learning** — read `docs/LESSONS.md`, then record non-obvious decisions/tradeoffs in `docs/lessons/<topic>.md`.
