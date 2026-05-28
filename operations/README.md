# Operations Docs

Operations docs own release flow, beta readiness, operational cadence, support, incidents, launches, and founder-facing operating surfaces.

## Active Docs

- [RELEASE.md](RELEASE.md): staging, beta, production, rollback, and release gates
- [IPHONE_HIG_ACCEPTANCE.md](IPHONE_HIG_ACCEPTANCE.md): append-only physical-iPhone acceptance evidence required for beta/production candidates
- [BETA.md](BETA.md): beta-specific readiness and testing notes
- [FOUNDER_OS.md](FOUNDER_OS.md): founder command center and operational control-plane strategy
- [CURRENT_STATE.md](CURRENT_STATE.md): living priorities, blockers, release state, and risks
- [OPERATIONAL_CADENCE.md](OPERATIONAL_CADENCE.md): daily, weekly, monthly, and quarterly review rhythm
- [OBSERVABILITY.md](OBSERVABILITY.md): Sentry crash/error reporting and visibility targets before dashboards exist
- [ADMIN_PLATFORM.md](ADMIN_PLATFORM.md): internal admin control matrix for moderation, support, restaurant data, flags, and dashboards
- [AUTOMATION.md](AUTOMATION.md): automation philosophy, maturity model, and roadmap
- [DATA_MODE.md](DATA_MODE.md): mock, mixed, and live data-mode boundaries
- [COSTS.md](COSTS.md): provider cost ownership, review gates, and quota readiness
- [FEATURE_FLAGS.md](FEATURE_FLAGS.md): feature flag metadata, Supabase emergency overrides, stale-flag handling, and rollback expectations
- [EXPERIMENTS.md](EXPERIMENTS.md): measurable experiment registry with expiry and rollback criteria
- [JOBS.md](JOBS.md): retry, max-attempt, and human override policy for future background jobs
- [RISK_REVIEW.md](RISK_REVIEW.md): reversibility, blast-radius, burden, observability, and human override review
- [DEBT.md](DEBT.md): technical, operational, security, product, data, cost, and growth debt taxonomy
- [PR_REVIEW.md](PR_REVIEW.md): PR summary and manual review checklist used by `npm run ops:pr`
- [OPERATIONAL_METADATA.md](OPERATIONAL_METADATA.md): standard metadata for durable/risky systems
- [INCIDENTS.md](INCIDENTS.md): lightweight incident severity and support handling
- [METRICS.md](METRICS.md): operational metric families and measurement rules
- [LAUNCHES.md](LAUNCHES.md): launch tracking template and release dependency rules

## Governance

- Keep promotion process and release state here, not in product or design docs.
- Update these docs when app environments, EAS profiles, release gates, smoke tests, rollback plans, or beta workflows change.
- Prefer lightweight operational surfaces over heavy process.
- Keep living status in `CURRENT_STATE.md`; keep durable rules in owner docs.
- Keep backup and restore rules in [../docs/security/DISASTER_RECOVERY.md](../docs/security/DISASTER_RECOVERY.md).
- Use `npm run check:dr` for local backup/restore readiness and restored-schema verification.
- Keep provider cost and feature-flag release controls visible before beta/prod promotion.
- Use `npm run ops:pr` for a local PR summary and review checklist.
