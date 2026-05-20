# ISO Evidence Summary

This report is the human-owned companion to `npm run check:iso`. It does not claim ISO certification; it records where inspection evidence lives.

| Area | Evidence owner |
| --- | --- |
| Asset inventory | `docs/security/COMPLIANCE.md` |
| Access control | `docs/security/SECURITY.md`, Supabase migrations, `npm run check:rls` |
| Supplier/provider management | `docs/security/COMPLIANCE.md`, `operations/COSTS.md`, `npm run check:providers` |
| Secure development | `docs/architecture/API_GOVERNANCE.md`, `scripts/check-hygiene.js`, CI |
| Incident response | `docs/security/SECURITY.md`, `operations/INCIDENTS.md` |
| Logging/monitoring | `docs/analytics/ANALYTICS.md`, `operations/OBSERVABILITY.md`, `restaurant_audit_events` |
| Vulnerability management | `npm run check:deps` |
| Backup/recovery | `docs/security/DISASTER_RECOVERY.md`, `npm run check:dr` |
| Data classification/retention/privacy | `docs/security/COMPLIANCE.md`, `npm run check:data-inventory`, `npm run check:privacy` |
| Change management | `BACKLOG.md`, ADRs, `.github/workflows/ops-checks.yml` |

Use `npm run check:iso -- --summary --write` to regenerate a machine-produced snapshot when needed.
