# Jobs And Retries

This doc defines the retry and human-override policy for future background jobs, cron tasks, queues, and workers.

## Policy

- Every job-like script must expose `retry`, `maxAttempts`, and `manualOverride` semantics.
- Retries must be bounded and observable.
- Repeated failures must create an operational warning, incident note, or backlog item.
- Human override must exist for jobs that can write production data, notify users, or call paid providers.
- Jobs must be safe to retry or explicitly idempotent.
- Jobs that touch provider data, privacy requests, retention, deletion/export, ranking, notifications, moderation, or canonical restaurant fields must name a Compliance Impact and audit event.
- Destructive retention/deletion jobs start in report-only mode before automatic deletion.

## Standard Metadata

Future job docs or scripts should name:

- Owner.
- Trigger.
- Inputs and outputs.
- Retry strategy.
- Max attempts.
- Manual override path.
- Observability signal.
- Rollback or roll-forward path.
- Idempotency key.
- Compliance guard.
- Cost/quota guard.
- Audit event.

## Automated Monitors

| Monitor | Trigger | Output | Human override |
| --- | --- | --- | --- |
| Provider usage monitor | Daily/weekly CI or ops report | Google/provider call counts, fallback reasons, cache hit rate, cost warnings | Disable fallback provider or lower quota |
| Cache freshness monitor | Weekly | Stale provider cache and refresh failures | Refresh only demanded records |
| Audit completeness monitor | Weekly | Sensitive mutation paths without audit evidence | Block release until audit exists |
| RLS drift monitor | PR/release/weekly | Tables without RLS or unexpected write policies | Fix migration or document exception |
| Retention/deletion monitor | Monthly | Expired cache, stale analytics, old push tokens, deleted-account remnants | Report-only until approved cleanup |
| Privacy request tracker | Daily during beta/prod | Open export/deletion/correction/access requests and due dates | Support/security owner review |
| Provider terms reminder | Monthly/quarterly | Overdue Google, maps, OSM, Supabase, Expo, Resend, storage, AI review | Block release if stale |
| Cost/quota monitor | Weekly/before release | Google, Supabase, Resend, Expo Push, storage, AI thresholds | Provider kill switch or release hold |
| Security evidence monitor | Weekly/quarterly | Dependency audit, secrets review, incident drill, backup restore, RLS audit status | Security owner review |
