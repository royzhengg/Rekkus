# Operational Metadata

Major systems should expose enough metadata for humans and agents to reason about ownership, rollout, and risk.

## Standard Fields

Use these fields in docs, release notes, backlog rows, or future tooling when a system has operational risk:

| Field | Meaning |
| --- | --- |
| Owner | Human or area responsible for the system. |
| State | Draft, active, beta, production, deprecated, or archived. |
| Dependencies | Docs, services, providers, tables, jobs, or flags it relies on. |
| Observability | What signal proves it is healthy. |
| Rollback | How to disable, revert, or roll forward safely. |
| Operational Burden | Low, Medium, or High. |
| Review Cadence | When it should be revisited. |

## Rules

- Add metadata when the system is durable or risky.
- Keep metadata concise; do not add ceremony to tiny docs or obvious code.
- If the metadata reveals missing checks, add the work to [../BACKLOG.md](../BACKLOG.md).

