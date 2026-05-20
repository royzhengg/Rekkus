# Testing Governance

Owner: Engineering

Testing exists to protect release confidence without slowing every small change.

## Default Checks

| Change type | Required checks |
| --- | --- |
| Docs only | `npm run check:docs`, `npm run check:ops` |
| Operations/backlog | `npm run check:ops`, `npm run check:hygiene` |
| TypeScript or React Native | `npm run typecheck`, `npm run lint` when practical |
| Release or env | `npm run check:release` |
| Platform config | `npm run check:platform` |
| Dependencies | `npm run check:deps`, `npm run check:ops` |

## Philosophy

- Prefer deterministic checks for repo rules, release gates, and docs drift.
- Add targeted tests around shared hooks, services, and cross-feature behavior.
- Use manual smoke testing for flows that need device capabilities until automated coverage exists.
- Keep test scope proportional to blast radius.

## Guardrails

- `package.json` must expose the core check scripts used by local work and CI.
- `scripts/ops/check-operations.js` validates the existence of this testing contract.
- New risky workflows should document the smallest repeatable verification path.
