# Observability

This doc defines what must become visible before Rekkus depends on it operationally.

## Visibility Targets

| Area                   | Signal                                                                      | Current Owner                                                    |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Release health         | Check results, smoke test status, rollback build                            | [RELEASE.md](RELEASE.md)                                         |
| App failures           | Sentry crash/error reporting                                                | Engineering                                                      |
| Onboarding             | Signup/login/reset-password anomalies                                       | [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) |
| Uploads                | Upload failure rate, storage growth                                         | [../docs/security/SECURITY.md](../docs/security/SECURITY.md)     |
| Jobs                   | Failed cron/job/retry counts                                                | Future async/job docs                                            |
| Costs                  | Google, Supabase, Resend, Expo, AI usage                                    | [../BACKLOG.md](../BACKLOG.md)                                   |
| Moderation             | Report volume, spam spikes, appeals                                         | [../docs/security/SECURITY.md](../docs/security/SECURITY.md)     |
| Operational automation | `check:ops` failures, warnings, and generated summaries                     | [AUTOMATION.md](AUTOMATION.md)                                   |
| Compliance             | Compliance Impact, data inventory, privacy, provider, RLS, audit, ISO gates | [../docs/security/COMPLIANCE.md](../docs/security/COMPLIANCE.md) |
| Provider reliance      | Cache hit/miss, Google fallback, provider refresh failures, quota warnings  | [COSTS.md](COSTS.md)                                             |
| Audit evidence         | Restaurant audit events, privacy request status, release evidence           | [ISO_EVIDENCE.md](ISO_EVIDENCE.md)                               |
| Post edit evidence     | `post_edit_events` field-name/count rows and `posts.edit_count`             | [../docs/security/COMPLIANCE.md](../docs/security/COMPLIANCE.md) |

## Report-Only Signal Map

`npm run check:observability` verifies the operating surface for these signals. The script is intentionally report-only: it proves ownership, source, and response paths exist before Rekkus depends on paid dashboards or always-on background jobs.

| Backlog | Signal                      | Source                                                                         | Cadence                                                     | Response                                                                                                           |
| ------- | --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| B-156   | Crash/error reporting       | Sentry React Native SDK, `components/ErrorBoundary.tsx`, EAS source maps       | Before beta/prod activation and after user-reported crashes | Keep capture dormant until staging symbolication is verified; then triage issues and rollback if release-blocking. |
| B-157   | Release health              | `npm run check:release`, Release Health Checklist                              | Every beta/prod promotion                                   | Stop release until failed gate has owner and rollback path.                                                        |
| B-158   | Analytics quality           | `docs/analytics/EVENTS.md`, `lib/analytics.ts`, analytics sanitizer            | Every analytics event change                                | Remove unsafe payloads, update event docs, rerun checks.                                                           |
| B-159   | Onboarding anomaly          | `onboarding_step` and `onboarding_anomaly` events from auth service boundaries | Weekly during beta; every auth release                      | Investigate spikes by step and provider without storing email/password payloads.                                   |
| B-160   | Upload failure              | `upload_failure` events from media picker/upload flows                         | Weekly during beta; every media release                     | Fix validation/storage regressions and review media cost/security docs.                                            |
| B-161   | Failed job/cron             | `npm run check:jobs`, `operations/JOBS.md`                                     | Every release and after job-like script changes             | Keep jobs report-only or add retry/manual override before production reliance.                                     |
| B-162   | API cost                    | Provider dashboards plus `operations/COSTS.md` API Cost Dashboard              | Weekly during beta; before production                       | Reduce fallback volume, add quota alerts, or pause launch.                                                         |
| B-163   | AI cost                     | AI Cost Monitor in `operations/COSTS.md`; no runtime AI dependency today       | Before any AI-assisted product or ops feature               | Add budget owner, purpose, quota, and fallback before enabling AI spend.                                           |
| B-164   | Moderation spike            | Future moderation/report queue plus security review                            | Before UGC beta and weekly after queue exists               | Escalate abuse review, throttle risky surfaces, update backlog.                                                    |
| B-165   | Storage growth              | Storage Growth Monitor in `operations/COSTS.md` and media pipeline docs        | Weekly during beta; every media-heavy launch                | Investigate growth, cleanup abandoned uploads, adjust media limits if needed.                                      |
| B-166   | App Store review            | App Store Review Tracking in `operations/LAUNCHES.md`                          | Each external build submission                              | Feed store feedback into release notes, incidents, or backlog.                                                     |
| B-167   | Revenue instrumentation     | `business/INSTRUMENTATION.md` and analytics event review                       | Before monetization experiments                             | Keep revenue metrics transparent and subordinate to dish-first utility.                                            |
| B-168   | Operational dashboard       | `npm run ops:summary` and `.temp/ops` reports                                  | Daily while actively shipping                               | Use generated summary before building UI dashboards.                                                               |
| B-169   | Founder command center      | `operations/FOUNDER_OS.md`                                                     | Weekly or before release decisions                          | Collapse blockers, cost, release, moderation, and metrics into one review.                                         |
| B-170   | VS Code operational surface | `.vscode/tasks.json` npm tasks                                                 | As needed during implementation                             | Run local operational checks without leaving the workspace.                                                        |

## Rules

- Add dashboards only after the signal source exists.
- Prefer alerts for silent failures, not vanity metrics.
- Keep any future AI summaries grounded in deterministic signals.
- If a signal is missing and operationally important, add or update a backlog item.
- Use `npm run ops:summary` for the lightweight v1 dashboard.
- Every new operational signal should have an owner, source, threshold or review cadence, and rollback or response path.
- Keep release, backup, cost, feature-flag, and experiment visibility in existing operations docs before adding a new dashboard.
- Future feature releases must expose monitoring or automated checks for compliance, legal, security, provider, cost, and audit risk before relying on the feature in beta/production.
- Post editing observability is intentionally minimized: watch edit counts, save failures, and audit row presence; never add raw caption/media/address diffs to logs or analytics.
- Sentry is the crash/error provider for Expo/React Native. Capture is temporarily off for development, staging, and beta; `EXPO_PUBLIC_SENTRY_ENABLED=true` plus `EXPO_PUBLIC_SENTRY_DSN` is the only runtime activation path.
- Keep the Expo plugin configured while capture is dormant; disabling client capture must not remove future source-map wiring or reintroduce incomplete plugin configuration.
- Create one Rekkus React Native project before monitored release validation. Set its non-secret `SENTRY_ORG` and `SENTRY_PROJECT` build metadata in the EAS environment used by an enabled staging verification or production build.
- `SENTRY_AUTH_TOKEN` must remain an EAS secret for source-map upload and must never be committed or added to local `.env`.
- Beta and production promotion remain blocked until staging is intentionally re-enabled, one controlled exception is recorded with environment `staging`, and the stack trace is symbolicated.

## Minimum Signal Contract

| Field    | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| Owner    | Person or area responsible for reviewing the signal.           |
| Source   | Script, provider dashboard, table, event, or manual checklist. |
| Cadence  | When the signal is reviewed.                                   |
| Response | What happens when the signal is unhealthy.                     |
