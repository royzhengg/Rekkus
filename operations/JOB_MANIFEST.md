# Job Manifest

Small evidence manifest for scheduled/background jobs. Keep this short and update it when a job is added, removed, renamed, or moved.

| Job | Function/script | Schedule | Required secret | Manual trigger | Success payload | Alert owner |
| --- | --- | --- | --- | --- | --- | --- |
| Analytics retention | `supabase/functions/analytics-retention` | Daily, production cron | `SUPABASE_SERVICE_ROLE_KEY` | Invoke `analytics-retention` from Supabase dashboard or CLI | Deleted raw `analytics_events` older than 90 days; no private payload logged | Roy |

