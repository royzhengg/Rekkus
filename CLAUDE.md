# CLAUDE.md

Use [AGENTS.md](AGENTS.md) as the canonical AI/operator guide.

Claude-specific reminders:

- Keep responses concise.
- Minimize unrelated repo scanning.
- Preserve existing architecture and behavior unless the task explicitly changes them.
- Do not introduce new dependencies, broad rewrites, or parallel systems without explicit approval.

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

**Checks** — run the checks that match the change (see AGENTS.md Required Checks). The Stop hook runs them automatically, but fix any failures before handing back.

**Learning** — if a decision, tradeoff, or gotcha was non-obvious, record it in `docs/LESSONS.md` under the right section rather than leaving it only in the conversation.

