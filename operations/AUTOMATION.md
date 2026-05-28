# Automation

This doc owns automation philosophy and the operational intelligence roadmap.

## Philosophy

Automate repetitive work when the manual workflow is clear, valuable, and observable.

Good automation:

- Reduces future operational burden.
- Has a human override.
- Produces visible output or logs.
- Fails safely and can be retried.
- Updates the right docs or backlog when it changes operating truth.

Avoid automation that hides state, adds brittle magic, or replaces a decision that still needs human judgment.

## Maturity Model

| Stage | Shape | Examples |
| --- | --- | --- |
| 1. Lightweight | Manual checklist with clear owner | Release gates, current-state notes |
| 2. Visible | Scripted checks and simple reports | Hygiene checks, docs checks, platform checks |
| 3. Assisted | AI summaries from deterministic signals | Release summaries, stale-doc summaries |
| 4. Automated | Safe retries and routine maintenance | Job retries, stale-cache refresh, report generation |

Do not jump to Stage 3 or 4 before the signal is real and the manual path is understood.

## Roadmap

- `npm run check:ops` runs deterministic operational checks for stale docs, backlog hygiene, migration tracking, feature-flag metadata, experiment expiry, cost readiness, retry policy, and architecture drift.
- `npm run check:compliance`, `npm run check:data-inventory`, `npm run check:rls`, `npm run check:audit`, `npm run check:providers`, `npm run check:privacy`, `npm run check:jobs`, and `npm run check:iso` enforce compliance, legal, provider, audit, job-monitor, security, and ISO evidence gates for future feature releases.
- `npm run check:search` verifies search index operations, fallback, cache, ranking, precomputed signal, and cuisine taxonomy guardrails.
- `npm run check:observability` verifies release, analytics, onboarding, upload, job, cost, moderation, storage, store-review, revenue, founder dashboard, and VS Code signal coverage.
- `npm run check:hig-acceptance` validates the iPhone HIG evidence register in CI and blocks beta/production promotion unless `REKKUS_RELEASE_CANDIDATE` identifies a matching physical-device pass.
- `npm run ops:summary` prints a founder-facing operational summary from deterministic repo signals.
- `npm run ops:report` writes ignored report artifacts to `.temp/ops/summary.md` and `.temp/ops/summary.json`.
- `npm run ops:pr` prints a changed-file summary and review checklist for PR preparation.
- `npm run check:dead-code` reports conservative dead-code candidates for manual review.
- `.github/workflows/ops-checks.yml` runs the same local checks in CI.
- `.vscode/tasks.json` exposes the VS Code operational surface for local ops summary, hygiene, release, typecheck, and lint tasks.
- `npm run check:deps` runs dependency audit on demand.

Each automation candidate should become a backlog item before implementation.

Automation-shaped backlog rows should not ship as docs-only. Ship a visible script, check, report, guardrail, or intentionally mark the row `[~]` until implementation evidence exists.

## Human Override

- Automation may block objective failures such as duplicate backlog IDs, malformed migrations, or invalid feature-flag metadata.
- Automation should warn, not block, on early operational drift such as missing migration docs, unreferenced flags, or missing future signals.
- Release, migration, abuse, billing, and provider-cost decisions remain human-owned.
