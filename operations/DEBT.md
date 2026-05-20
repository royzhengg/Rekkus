# Debt Taxonomy

Owner: Engineering / operations

Debt belongs in the backlog when it can affect product quality, safety, cost, release confidence, or future delivery.

## Categories

| Category | Meaning | Default Owner |
| --- | --- | --- |
| Technical debt | Code, architecture, tests, dependencies, or performance risk | Engineering |
| Operational debt | Manual process, missing runbook, weak observability, or brittle release step | Operations |
| Security debt | RLS, auth, abuse, secrets, upload, backup, or dependency risk | Security / engineering |
| Product debt | User-visible behavior gap, unclear copy, missing state, or broken loop | Product |
| Data debt | Schema, data quality, migration, analytics, repair, or canonical ID risk | Engineering |
| Cost debt | Provider spend, quotas, storage growth, or paid API dependence | Operations |
| Growth debt | Activation, retention, referral, creator, or marketplace loop weakness | Product / growth |

## Rules

- Put debt in the most specific backlog section, not the bottom by default.
- Include why it matters, dependencies, burden, and the smallest reversible step.
- Use `operations/RISK_REVIEW.md` when debt adds ongoing burden or irreversible behavior.
- Keep completed debt rows as shipped history once resolved.

