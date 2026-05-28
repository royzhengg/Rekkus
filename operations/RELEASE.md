# Release

Use this file to promote safely from staging to beta to production.

Release governance is intentionally lightweight: clear environments, explicit gates, migration discipline, and a known rollback path.

## Environments

| Environment | Audience         | Data mode         | Identifier                     |
| ----------- | ---------------- | ----------------- | ------------------------------ |
| development | Local dev        | `mock` or `mixed` | Expo dev                       |
| staging     | Internal testing | `live`            | `com.anonymous.rekkus.staging` |
| beta        | External testers | `live`            | `com.anonymous.rekkus.beta`    |
| production  | Public users     | `live`            | `com.anonymous.rekkus`         |

`app.config.js` derives native identifiers from `EXPO_PUBLIC_APP_ENV`.

## Environment Governance

| Environment | Allowed Data               | Purpose                               | Promotion Rule                                                              |
| ----------- | -------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| development | `mock`, `mixed`, or `live` | Local implementation and debugging    | Never treated as release evidence by itself.                                |
| staging     | `live`                     | Internal release candidate validation | Must pass release checks before beta.                                       |
| beta        | `live`                     | External tester validation            | Must complete regression, crash, quota, and abuse review before production. |
| production  | `live`                     | Public users                          | Requires identified rollback build and production backup readiness.         |

Seed/demo data may be used in development only. Staging, beta, and production must use live data boundaries and provider keys scoped to the target environment.

## Release Gates

Before any beta or production promotion:

- Confirm `EXPO_PUBLIC_APP_ENV` matches the target environment.
- Confirm `EXPO_PUBLIC_DATA_MODE=live`.
- For beta/production candidates, record the physical-iPhone matrix in [IPHONE_HIG_ACCEPTANCE.md](IPHONE_HIG_ACCEPTANCE.md), then run `REKKUS_RELEASE_CANDIDATE=<build-id> npm run check:release`.
- Run compliance gates when data, provider, privacy, analytics, media, auth, notification, ranking, moderation, or admin behavior changed: `npm run check:compliance`, `npm run check:data-inventory`, `npm run check:rls`, `npm run check:audit`, `npm run check:providers`, `npm run check:privacy`, and `npm run check:iso`.
- Run `npm run check:dr` when promoting beta/production, after backup changes, or before destructive migrations.
- Review migration impact and rollback path.
- Review backup readiness in [../docs/security/DISASTER_RECOVERY.md](../docs/security/DISASTER_RECOVERY.md).
- Review feature flags and kill switches for risky changes.
- Keep `iosTabBarMaterial` disabled for beta and production; its development/staging evaluation cannot be promoted until a later reviewed change includes passing physical-iPhone Reduce Transparency evidence.
- Review Compliance Impact for risky changes: data collected, source, purpose, retention, deletion/export, provider terms, attribution, RLS/security, audit trail, App Store privacy details, Google Play Data Safety, cost/quota impact, and rollback.
- Confirm known issues are documented in the release notes or backlog.
- Review dependency automation posture: Dependabot/security alerts, `npm audit`, SBOM need, and license risk for new direct dependencies.
- Sentry capture is temporarily disabled for staging and beta. Do not promote beta or production until staging has been intentionally enabled for a controlled symbolicated-event verification.
- For an enabled Sentry verification or production build, confirm the Rekkus Sentry project exists, its EAS environment provides `SENTRY_ORG`, `SENTRY_PROJECT`, and `EXPO_PUBLIC_SENTRY_DSN`, and `SENTRY_AUTH_TOKEN` is present only as an EAS secret.
- Confirm Google Maps, Google Places, and Giphy key restrictions/rotation status are recorded before beta/production.
- If a native dependency or Expo config plugin changed, run the native prebuild/build path for both iOS and Android release candidates before beta promotion.

## Release Health Checklist

Before promoting a beta or production build, record the release health result in the launch note, PR, or current-state note:

| Signal                  | Command or source                                                                                  | Healthy result                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Platform config         | `npm run check:platform`                                                                           | App identifiers and public config match the target environment.                                                                         |
| Docs and operations     | `npm run check:hygiene`                                                                            | Backlog, docs, search, observability, compliance, providers, and data inventory pass.                                                   |
| Search readiness        | `npm run check:search`                                                                             | Search local-first, fallback, cache, ranking, and taxonomy guardrails are intact.                                                       |
| Observability readiness | `npm run check:observability`                                                                      | Release, analytics, onboarding, upload, cost, moderation, store-review, revenue, and command-center signals have owner/source coverage. |
| Sentry release signal   | Controlled staging exception after temporary staging enablement                                    | Event is tagged `staging` and its stack trace is symbolicated before beta or production promotion.                                      |
| Privacy/security        | `npm run check:privacy`, `npm run check:rls`, `npm run check:audit`, `npm run check:iso`           | Privacy requests, RLS, audit, and ISO evidence checks pass.                                                                             |
| Jobs                    | `npm run check:jobs`                                                                               | Job-like workflows remain report-only or have retry/manual override policy.                                                             |
| Dependencies/types      | `npm run check:deps`, `npm run typecheck`                                                          | No unresolved dependency or TypeScript blocker is accepted into release.                                                                |
| iPhone HIG acceptance   | `REKKUS_RELEASE_CANDIDATE=<build-id> npm run check:hig-acceptance`                                 | The matching physical-iPhone matrix passes VoiceOver, Dynamic Type, Reduce Motion, Reduce Transparency, dark mode, permission, and touch-target checks. |
| Manual smoke            | Auth, reset password, create post, search, post detail, restaurant detail, map, profile, redirects | No P0 regression; rollback build is identified.                                                                                         |

## Security Release Checklist

- Confirm auth/email cooldowns and provider rate limits are still documented before external beta.
- Confirm report/block surfaces work for posts, comments, and profiles before any UGC store submission.
- Confirm moderation, dispute, takedown, appeal, soft-delete, audit, and trust-profile schema evidence exists.
- Confirm vulnerability disclosure contact, NDB/OAIC incident readiness, and DPIA/PIA review are current for risky releases.
- Confirm static security scanning posture, dependency audit, and secret-scanning owner are reviewed before production.

## Staging To Beta

- `EXPO_PUBLIC_DATA_MODE=live`.
- Staging and beta builds remain Sentry-dormant by default while B-156 is open.
- Before promotion, create/configure the Rekkus Sentry project; intentionally enable staging, set its EAS values for `SENTRY_ORG`, `SENTRY_PROJECT`, and `EXPO_PUBLIC_SENTRY_DSN`, with `SENTRY_AUTH_TOKEN` as an EAS secret only.
- Confirm a controlled staging exception reaches Sentry with environment `staging` and a symbolicated stack trace; capture may remain off for beta under the temporary policy.
- `REKKUS_RELEASE_CANDIDATE=<build-id> npm run check:release` passes with matching physical-iPhone evidence in [IPHONE_HIG_ACCEPTANCE.md](IPHONE_HIG_ACCEPTANCE.md).
- `npm run check:dr` passes against repo migrations or a restored non-production schema dump.
- No direct mock imports in app/feature production paths.
- RLS audit complete.
- Audit coverage complete for canonical restaurant changes, provider cache refreshes, privacy requests, admin/moderation actions, and async jobs introduced by the release.
- Google/Supabase/Resend keys restricted.
- Privacy Policy and Terms links are present and non-placeholder before external testing: `https://rekkus.com/privacy` and `https://rekkus.com/terms`.
- Apple App Store privacy details and Google Play Data Safety impact reviewed.
- UGC report, block, moderation, dispute, takedown, and support paths reviewed before any external UGC beta.
- Location permission timing, manual fallback, precise-location retention, store disclosure, and the `B-524` explicit-action regression check reviewed.
- VoiceOver, Dynamic Type, Reduce Motion, Reduce Transparency, dark mode, permission recovery, and touch-target checks pass for the candidate in [IPHONE_HIG_ACCEPTANCE.md](IPHONE_HIG_ACCEPTANCE.md).
- Create draft migration and private `post-drafts` storage policies applied; verify saved drafts sync across sessions while autosaves remain recovery-only.
- Post edit migration `20240222000000_post_edit_events.sql` applied; verify owner-only edit saves update the same post ID and `post_edit_events` contains only event type plus changed field names/count.
- Local migration evidence: Colima-backed Docker is the current local Supabase runtime on Apple Silicon; `supabase migration up` reports the local database is up to date through `20240226000000_search_history_aggregate.sql`, and local schema verification confirmed `posts.last_edited_at`, `posts.edit_count`, and `post_edit_events`. Local `supabase/config.toml` has Supabase analytics disabled because the analytics sidecar cannot mount the Colima Docker socket on macOS.
- Vulnerability disclosure and NDB/OAIC incident readiness reviewed before public beta.
- Provider attribution requirements are reviewed for Google, maps, OSM/open data, and future providers.
- iOS and Android builds install and launch.
- Auth, reset password, create post, search, post detail, restaurant detail, map, profile, and redirects pass smoke testing.
- Known issues documented.

## Beta To Production

- Beta crash/regression review complete.
- The production candidate has a matching passing physical-iPhone record in [IPHONE_HIG_ACCEPTANCE.md](IPHONE_HIG_ACCEPTANCE.md).
- Sentry production capture is enabled and a symbolicated staging verification has been recorded; enable beta capture first if beta crash review is required for the release decision.
- API quota usage reviewed.
- Abuse/rate-limit controls reviewed.
- Supabase backups/PITR or scheduled dumps configured.
- Restore verification passes with `RESTORE_DRILL_SCHEMA_SQL=/path/to/restored-schema.sql npm run check:dr` once a restored non-production project exists.
- Privacy policy and terms wired to `https://rekkus.com/privacy` and `https://rekkus.com/terms`.
- Account deletion/export path wired through the app or `privacy@rekkus.com`.
- Report/block/moderation flow and takedown/dispute intake verified for UGC surfaces.
- Age rating and alcohol/bar/menu-content implications reviewed for App Store and Play Store metadata.
- Push notifications and deep links tested.
- App Store and Play Store metadata reviewed.
- Provider quota/cost, privacy, data safety, RLS, audit, and ISO evidence reviewed.
- Rollback build identified.

## Database Migration Promotion

Migration governance favors additive, reversible, and observable changes.

Before a migration:

1. Confirm the migration filename is timestamped and ordered.
2. Confirm the migration is additive when possible.
3. Document destructive or non-reversible behavior in the release notes or an ADR.
4. Confirm app compatibility across the previous and next app versions.
5. Identify the rollback or roll-forward plan.

Promotion flow:

1. Apply migration to staging.
2. Verify app compatibility and RLS behavior.
3. Back up production.
4. Apply migration to production.
5. Run smoke tests and monitor errors.
6. Update [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) when schema truth changes.

## Rollback

- Keep the previous stable EAS build available.
- If a backend migration is not reversible, ship a compatibility app fix before rolling forward.
- Rotate or revoke keys immediately if release failure involves secret exposure.
- Disable risky feature paths through `feature_flag_overrides` before waiting for a replacement build when a flag can contain the incident.
- Prefer roll-forward fixes for already-applied production migrations unless a tested rollback exists.
- Use [../docs/security/DISASTER_RECOVERY.md](../docs/security/DISASTER_RECOVERY.md) for database, storage, migration, and secret-exposure recovery paths.
