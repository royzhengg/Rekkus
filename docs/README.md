# Reference Docs

Reference docs hold deeper technical, security, analytics, and historical material. Root docs stay reserved for authority entrypoints.

## Active Areas

- [GOVERNANCE.md](GOVERNANCE.md): documentation ownership, lifecycle rules, budgets, and ADR policy
- [GOVERNANCE_INDEX.md](GOVERNANCE_INDEX.md): discoverable index of governance owner docs without duplicating their rules
- [adr/README.md](adr/README.md): architecture decision records and ADR template
- [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md): app architecture, code ownership, data boundaries, and platform direction
- [architecture/ENGINEERING_GOVERNANCE.md](architecture/ENGINEERING_GOVERNANCE.md): source-of-truth ownership, engineering constraints, and check selection
- [architecture/API_GOVERNANCE.md](architecture/API_GOVERNANCE.md): service boundaries, provider calls, Edge Function ownership, and API guardrails
- [architecture/CACHE_GOVERNANCE.md](architecture/CACHE_GOVERNANCE.md): cache ownership, TTL, invalidation, and stale-data rules
- [architecture/DATA_GOVERNANCE.md](architecture/DATA_GOVERNANCE.md): canonical IDs, data ownership, audits, repairs, and privacy-safe metadata
- [architecture/TESTING.md](architecture/TESTING.md): check selection and testing expectations by change type
- [architecture/DEPENDENCIES.md](architecture/DEPENDENCIES.md): package add policy, audit policy, and dependency ownership
- [architecture/NAMING.md](architecture/NAMING.md): naming conventions for routes, tables, events, files, and product language
- [architecture/PERFORMANCE.md](architecture/PERFORMANCE.md): mobile performance budgets, review triggers, and release checks
- [security/SECURITY.md](security/SECURITY.md): security risk register, RLS, secrets, abuse controls, and ISO-readiness mapping
- [security/COMPLIANCE.md](security/COMPLIANCE.md): compliance impact, data inventory, provider terms, privacy rights, audit evidence, and ISO inspection readiness
- [security/DISASTER_RECOVERY.md](security/DISASTER_RECOVERY.md): backup cadence, restore drills, migration recovery, storage recovery, and incident recovery paths
- [security/MEDIA_PIPELINE.md](security/MEDIA_PIPELINE.md): upload validation, media variants, storage lifecycle, and media cost rules
- [analytics/ANALYTICS.md](analytics/ANALYTICS.md): analytics events, ranking signals, funnels, and measurement notes
- [analytics/EVENTS.md](analytics/EVENTS.md): analytics event naming, payload, and privacy review rules
- [analytics/KPIS.md](analytics/KPIS.md): north-star and core product metrics
- [analytics/FUNNELS.md](analytics/FUNNELS.md): activation, discovery, contribution, and retention funnels
- [analytics/DASHBOARDS.md](analytics/DASHBOARDS.md): dashboard requirements for product, discovery, trust, and cost health
- [api/API_STANDARDS.md](api/API_STANDARDS.md): service/API request boundaries and contracts
- [api/ERROR_HANDLING.md](api/ERROR_HANDLING.md): UI, hook, service, and Edge Function error handling
- [api/PAGINATION.md](api/PAGINATION.md): pagination and list-loading rules
- [api/VERSIONING.md](api/VERSIONING.md): additive API evolution and future versioning triggers
- [moderation/MODERATION_OPERATIONS.md](moderation/MODERATION_OPERATIONS.md): report, block, dispute, and moderation workflow rules
- [infra/DEPENDENCY_GOVERNANCE.md](infra/DEPENDENCY_GOVERNANCE.md): dependency decision checklist and ownership
- [LESSONS.md](LESSONS.md): project lessons and historical notes

## Governance

- Keep detailed references here instead of adding more root markdown.
- Link back to root authority docs when strategy or execution order is involved.
- Update the relevant reference when architecture, security, analytics, or learned constraints change.
- Record durable decisions in ADRs when they affect architecture, providers, data ownership, security, release policy, or product constraints.
- Keep docs within the budgets in [GOVERNANCE.md](GOVERNANCE.md); split only when a new owner is clear.
