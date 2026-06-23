# Job Manifest

Small evidence manifest for scheduled/background jobs. Keep this short and update it when a job is added, removed, renamed, or moved.

| Job | Function/script | Schedule | Required secret | Manual trigger | Success payload | Alert owner |
| --- | --- | --- | --- | --- | --- | --- |
| Analytics retention | `supabase/functions/analytics-retention` | Daily, production cron | `SUPABASE_SERVICE_ROLE_KEY` | Invoke `analytics-retention` from Supabase dashboard or CLI | Deleted raw `analytics_events` older than 90 days; no private payload logged | Roy |
| osm-delta-refresh | `scripts/admin/osm/delta.ts` | Weekly (`0 2 * * 0` UTC) via `.github/workflows/osm-delta.yml`; manual via Actions tab or `npx ts-node scripts/admin/osm/delta.ts` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (GitHub Actions secrets) | Trigger from GitHub Actions → Run workflow, or `npx ts-node scripts/admin/osm/delta.ts [--state <code>] [--dry-run]` locally | Updated place fields for `osm_only`/`osm_google` places; `restaurant_audit_events` rows with `action='osm_delta_skipped'` for `community_verified`/`owner_verified` places | Roy |
| place-canonicalise | `scripts/admin/osm/canonicalise.ts` | On-demand (after each full OSM import or when duplicate reports spike) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `npx ts-node scripts/admin/osm/canonicalise.ts [--dry-run\|--seed\|--execute] [--min-confidence 0.85] [--distance 100] [--limit 500]` | Merged place pairs logged to `place_merge_log` + `restaurant_audit_events`; old place soft-deleted; posts/saves/dishes/collections re-pointed to winner | Roy |
