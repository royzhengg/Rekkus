# Admin Platform

Owner: Founder/operator until a dedicated admin owner exists.

The admin platform is the internal control surface for support, moderation, restaurant data, feature controls, and operational health. The v1 implementation is intentionally lightweight: queryable Supabase tables, documented workflows, and automated checks before a custom in-app dashboard.

## Operating Rules

- Keep admin tools internal and least-privilege; do not expose service-role behavior in the app.
- Prefer reversible actions with audit history before destructive edits.
- Keep raw private notes, secrets, emails, phone numbers, payment data, and unrestricted support correspondence out of dashboards.
- Use existing source-of-truth tables before creating new admin-only state.
- Treat restaurant pressure, abuse reports, and support escalations as trust work, not growth shortcuts.

## Control Matrix

| Control | Owner | Source | Action model | Rollback | Rollout |
| --- | --- | --- | --- | --- | --- |
| Internal admin dashboard | Founder/operator | `operations/ADMIN_PLATFORM.md`, `npm run check:admin-platform`, and `npm run ops:summary` | Read-only v1 control matrix plus generated ops reports before UI | Revert doc/check change or remove future dashboard route behind a flag | Ship as operations workflow first; UI only after signals exist |
| Moderation queue | Trust/security owner | `content_reports`, `moderation_actions`, `moderation_appeals`, `user_blocks` | Review report, record triage/action/dismissal/escalation | Restore content or reverse action through `moderation_actions` | Data-backed queue before admin UI |
| Ban/suspend users | Trust/security owner | `user_trust_profiles`, `moderation_actions` | Restrict user with actor, reason, target, and review timestamp | Change trust state and record restore action | Human-reviewed only before automation |
| Hide/remove posts | Trust/security owner | `posts.deleted_at`, `comments.deleted_at`, `post_photos.deleted_at`, `moderation_actions` | Soft hide content with reason and linked action | Clear soft-delete fields and record restore action | Keep storage cleanup as a later controlled job |
| Merge duplicate places | Data owner | `place_merge_events`, `place_provider_links`, `place_audit_events` | Record canonical/merged IDs, confidence, before/after summaries, and rollback reference | Use alias/merge history to restore references or supersede merge | Manual review before bulk merge tooling |
| Edit place metadata | Data owner | `places`, `place_observations`, `place_audit_events`, `data_repair_events` | Promote bounded corrections with provenance and audit evidence | Reapply prior value from audit/repair summary | Local DB first, provider refresh second |
| Feature flag tooling | Engineering owner | `lib/featureFlags.ts`, `operations/FEATURE_FLAGS.md`, `operations/RELEASE.md` | Change flag state with owner, review date, and rollback note | Disable or retire flag and verify affected path | Required for risky releases and experiments |
| Place verification tooling | Place/data owner | `place_ownership_events`, `place_provenance`, `place_audit_events` | Review claim evidence, approve/reject/transfer ownership | Supersede ownership event or remove owner | Manual workflow until place owner portal exists |
| User lookup | Support/security owner | `users`, privacy requests, moderation/report links | Lookup by bounded identifiers and case context | No mutation from lookup alone | Support-only workflow; avoid broad exports |
| Content repair tooling | Data owner | `data_repair_events`, audit tables, affected entity table | Move report from reported to in_review/repaired/rejected with before/after summary | Supersede repair event and restore prior value | Use for malformed restaurant, post, dish, and user data |
| Abuse tooling | Trust/security owner | `content_reports`, `user_blocks`, `abuse_signal`, `user_trust_profiles` | Detect spikes, triage, block/report, restrict only after review | Unblock, dismiss report, or restore trust state | Review before public UGC beta and weekly after launch |
| Support tooling | Founder/operator | `operations/INCIDENTS.md`, privacy requests, support case notes outside analytics | Classify case, link relevant request/report/incident, and track follow-up | Correct case status and update owner doc/backlog | Lightweight docs and owner workflow before ticketing system |
| Operational dashboards | Founder/operator | `docs/analytics/DASHBOARDS.md`, `operations/OBSERVABILITY.md`, `npm run ops:summary` | Summarize product, discovery, trust, cost, release, and support signals | Remove dashboard dependency or return to source docs | Simple generated dashboards before BI tools |

## Minimum Views

The first admin dashboard can be a generated or Supabase-backed internal view with these sections:

| View | Required fields | Source |
| --- | --- | --- |
| Queue | Status, priority, target type, target ID, report type, created timestamp | `content_reports` |
| Actions | Actor type, action type, target, reason, reversible, shadow mode, created timestamp | `moderation_actions` |
| Users | User ID, trust level, score band, last reviewed timestamp | `user_trust_profiles` |
| Places | Canonical place ID, pending ownership event, merge event, repair status | `place_ownership_events`, `place_merge_events`, `data_repair_events` |
| Flags | Flag, owner, state, enabled, review date | `lib/featureFlags.ts` |
| Operations | Release state, observability signals, incidents, support risks | `operations/CURRENT_STATE.md`, `operations/OBSERVABILITY.md`, `operations/INCIDENTS.md` |

## Release Gates

- Run `npm run check:admin-platform` when admin, moderation, restaurant repair, support, feature-flag, or dashboard behavior changes.
- Run `npm run check:hygiene` before marking admin-platform backlog rows shipped.
- Public UGC beta must review report/block flow, abuse controls, soft-delete behavior, and support escalation paths.
- Restaurant owner or metadata tools must review data governance, audit history, and rollback references before launch.

## Future UI Boundary

Do not create a broad generic admin app. When UI work becomes necessary, add the smallest authenticated internal route or external dashboard for the specific workflow, keep writes behind service/RLS-safe boundaries, and retain this control matrix as the owner index.
