# Founder OS

This doc defines the lightweight operational control plane for Rekkus. It should reduce founder cognitive load without creating enterprise process.

Summary: use `npm run ops:summary` for the generated operational snapshot and this doc for the durable control-plane shape.

---

## Purpose

Shift operations from memory-based tracking to system-based tracking:

- Current state lives in [CURRENT_STATE.md](CURRENT_STATE.md).
- Cadence lives in [OPERATIONAL_CADENCE.md](OPERATIONAL_CADENCE.md).
- Release gates live in [RELEASE.md](RELEASE.md).
- Observability needs live in [OBSERVABILITY.md](OBSERVABILITY.md).
- Automation philosophy and roadmap live in [AUTOMATION.md](AUTOMATION.md).

The command center should answer:

- What is the current priority?
- What is blocked?
- What is shipping next?
- What operational risk needs attention?
- What work should be automated later?

---

## Control Plane Principles

- Prefer one linked operational surface over scattered status notes.
- Keep current state separate from durable reference docs.
- Track risks before building dashboards.
- Automate repetitive work only after the manual workflow is clear.
- Preserve human override for release, migration, abuse, and billing decisions.
- Batch operational review into planned windows instead of interrupting product work for every signal.
- Prefer async written status, check output, and backlog commands over live rediscovery.
- Protect focus by making the next smallest reversible action explicit before starting broad roadmap work.

---

## Future Tooling Shape

Do not build dashboards until the signals exist. When ready, a founder-facing surface may summarize:

- Release state and rollback build.
- Active blockers and current priorities.
- Migration status.
- Crash, onboarding, moderation, and upload health.
- Provider costs and quota pressure.
- Stale docs, stale feature flags, stale experiments, and dependency risk.

## Operational Dashboard

The v1 operational dashboard is the generated CLI surface, not an in-app admin screen:

- `npm run ops:summary` prints the current operational snapshot.
- `npm run ops:report` writes ignored `.temp/ops/summary.md` and `.temp/ops/summary.json` artifacts.
- `npm run check:observability` verifies the signal map before dashboard UI work is allowed.

## Founder Command Center

The founder command center is the weekly review shape for the existing signals:

- Release health and rollback readiness.
- Current blockers and highest-priority backlog rows.
- Search, analytics, onboarding, upload, job, cost, moderation, store-review, and revenue signal gaps.
- Manual owner actions that cannot be automated yet.

## Founder Energy System

Use this cadence to reduce operational load:

- Daily: inspect only current blockers, failing checks, and urgent support/security signals.
- Weekly: run the command-center review, sequence the next backlog slice, and batch doc/backlog grooming.
- Before deep work: choose one owner doc and one delivery surface; defer adjacent master-plan ideas unless they unblock the slice.
- After shipping: record evidence in `BACKLOG.md`, then stop expanding scope unless checks expose a real blocker.

## VS Code Operational Surface

The workspace operational surface lives in `.vscode/tasks.json` and exposes the same npm commands used by release and ops docs: ops summary, hygiene, release, typecheck, and lint.
