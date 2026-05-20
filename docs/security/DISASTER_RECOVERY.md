# Disaster Recovery

This doc owns backup, restore, and recovery governance for Rekkus. It is intentionally lightweight until production traffic requires deeper runbooks.

---

## Recovery Principles

- Protect production user data before public launch.
- Prefer tested restore paths over assumed backups.
- Prefer roll-forward fixes for already-applied production migrations unless a tested rollback exists.
- Keep recovery actions visible in [../../operations/RELEASE.md](../../operations/RELEASE.md), [../../operations/INCIDENTS.md](../../operations/INCIDENTS.md), and [../../BACKLOG.md](../../BACKLOG.md).
- Never store raw secrets, user-private exports, or backup contents in markdown.

---

## Backup Ownership

| Asset | Backup Owner | Minimum Pre-Production Rule | Production Rule |
| --- | --- | --- | --- |
| Supabase Postgres | Supabase project owner | Confirm backup option before beta | Enable PITR or scheduled dumps before production |
| Supabase Storage | Supabase project owner | Confirm bucket inventory and recovery owner | Define restore path for avatars and post photos |
| Supabase migrations | Repo | Keep ordered migration files in `supabase/migrations/` | Verify production migration history before releases |
| Edge Functions | Repo | Source lives in `supabase/functions/` | Redeploy from repo during recovery |
| Expo builds | EAS / release owner | Keep latest stable beta build known | Keep previous stable production build available |
| Public provider config | Provider dashboards / repo docs | Document key restrictions before beta | Review restrictions before production releases |

---

## Cadence

| Cadence | Action |
| --- | --- |
| Before beta | Confirm Supabase backup capability, storage bucket inventory, and rollback build path. |
| Before production | Enable PITR or scheduled dumps, identify previous stable EAS build, and document provider recovery owners. |
| Monthly after production | Confirm latest backup exists and provider access still works. |
| Quarterly after production | Run a restore drill in a non-production project and update this doc with lessons learned. |
| Before destructive migration | Take production backup, document rollback or roll-forward plan, and verify app compatibility. |

---

## Restore Drill Checklist

Run drills against a non-production Supabase project.

1. Identify the backup or dump to restore.
2. Restore into a non-production project.
3. Apply migrations needed to match expected schema.
4. Verify RLS policies are enabled.
5. Verify critical tables: `users`, `posts`, `post_photos`, `restaurants`, `likes`, `saves`, `comments`, `analytics_events`.
6. Verify storage bucket access rules and sample media URLs.
7. Run app smoke tests against the restored environment.
8. Record gaps as backlog items.

## Automated Restore Verification

Run `npm run check:dr` before beta, production, destructive migrations, and quarterly restore drills.

By default, the check validates repo migrations for restore-critical tables, RLS coverage, storage bucket expectations, and release/doc wiring. During a real restore drill, export a schema-only dump from the restored non-production project and run:

```sh
RESTORE_DRILL_SCHEMA_SQL=/path/to/restored-schema.sql npm run check:dr
```

The schema dump path must stay outside committed docs unless it contains no private data and has been reviewed. Store only the date, environment, command result, and follow-up backlog links in release notes or incident notes.

---

## Recovery Paths

### Database Incident

1. Stop risky writes if possible with feature flags or release controls.
2. Assess affected tables, time window, and user impact.
3. Choose restore, rollback, or roll-forward fix.
4. Restore to a non-production project first when time allows.
5. Apply production fix.
6. Run release smoke tests and monitor errors.
7. Document the incident and follow-up work.

### Migration Incident

1. Identify whether the migration is reversible.
2. If reversible and tested, roll back in staging first.
3. If not reversible, ship a compatible roll-forward migration or app fix.
4. Update [../../operations/RELEASE.md](../../operations/RELEASE.md) and [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) if schema truth changes.

### Storage Incident

1. Identify affected bucket, paths, and upload window.
2. Disable affected upload flow if abuse or corruption is ongoing.
3. Restore from provider backup or rehydrate known media where possible.
4. Validate public-read expectations and user-scoped write rules.

### Secret Exposure

1. Rotate exposed key immediately.
2. Revoke sessions or tokens if user access may be affected.
3. Audit logs for suspicious usage.
4. Update provider restrictions and incident notes.

---

## Open Pre-Production Decisions

- Choose Supabase PITR vs scheduled dump approach for production.
- Define storage backup/export expectations for avatars and post photos.
- Decide where restore drill evidence should live without storing sensitive data.
