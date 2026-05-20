# Feature Flag Governance

Owner: Engineering

Feature flags are temporary release controls, not a place for permanent product forks.

## Metadata Contract

Each flag in `lib/featureFlags.ts` must include:

- `owner`
- `state`
- `enabled`
- `createdAt`
- `reviewAt`
- `description`

## Lifecycle

- `planned`: documented but not active.
- `active`: reachable in a build and reviewed before `reviewAt`.
- `paused`: disabled while a risk, dependency, or experiment is resolved.
- `retired`: removed from runtime references and then deleted.

## Experiment Linkage

- Flags that power experiments must name the experiment in `description` or the owning code comment.
- The flag `reviewAt` date should match or precede the experiment `Expiry Date` in [EXPERIMENTS.md](EXPERIMENTS.md).
- When an experiment ships, retire the flag unless it has become a release control with a new owner, rollback note, and review date.
- When an experiment stops, disable the flag first, confirm rollback, then remove stale runtime references in the smallest follow-up change.
- Flags must not preserve permanent alternate product behavior; promoted behavior should move into normal code paths.

## Guardrails

- `npm run check:ops` fails when required metadata is missing.
- Disabled flags past `reviewAt` warn as stale.
- Flags defined but not referenced outside `lib/featureFlags.ts` warn as stale.
- Risky releases must pair flags with a rollback note in `operations/RELEASE.md`.

## Human Override

When a flag controls a risky path, the implementation must describe who can flip it, where the change happens, and what confirms rollback worked.

## Admin Platform

Feature flag tooling is part of the internal admin platform control surface in [ADMIN_PLATFORM.md](ADMIN_PLATFORM.md) (`operations/ADMIN_PLATFORM.md`). A risky flag must keep owner, review date, state, rollback note, and release gate evidence visible before it becomes a dashboard action.
