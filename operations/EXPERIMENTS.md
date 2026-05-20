# Experiments

This registry keeps experiments measurable, temporary, and reversible.

## Template

Copy this row into the registry before enabling an experiment:

| Name | Status | Owner | Hypothesis | Start Date | Expiry Date | Success Metric | Rollback Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<experiment-name>` | `Active` | `<person/team>` | If `<change>` then `<measurable outcome>` because `<reason>`. | `YYYY-MM-DD` | `YYYY-MM-DD` | `<metric, baseline, target, source>` | Stop when `<metric/risk threshold>` occurs. |

Required setup before launch:

- Name the smallest reversible product or operational change.
- Assign one accountable owner.
- Set duration through `Start Date` and `Expiry Date`; default to 14 days or less unless the owner records why a longer window is needed.
- Define one primary success metric with baseline, target, and measurement source.
- Define rollback criteria before the experiment reaches beta or production users.
- Link any related feature flag in the hypothesis or rollback trigger text.

## Registry

| Name | Status | Owner | Hypothesis | Start Date | Expiry Date | Success Metric | Rollback Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Rules

- Use `Active`, `Paused`, `Shipped`, or `Stopped` for status.
- Active experiments must have an expiry date and rollback trigger.
- Every experiment must name an owner, hypothesis, start date, expiry date, success metric, and rollback trigger.
- Experiments should be time-boxed to the smallest reversible product change.
- Expired active experiments must be reviewed, shipped, paused, or stopped during the next weekly operations review.
- Feature flags used for experiments must be reviewed with the experiment and retired or given a new `reviewAt` date when the experiment closes.
- Shipped experiments must either update the owning product doc or create follow-up backlog work.
- Keep stopped experiments in the registry as lightweight history; do not delete them unless they were entered in error.

## Inventory Review

- Weekly: scan the registry for `Active` rows with expired dates, missing measurement, or rollback triggers that have fired.
- Before beta/prod release: confirm no active experiment lacks an owner, success metric, rollback trigger, or linked flag review.
- Monthly: convert `Shipped` experiment learnings into owner docs or backlog work, then prune stale `Paused` experiments by shipping, stopping, or assigning a new expiry.
- After incidents or cost spikes: check whether an experiment contributed and record the decision in [INCIDENTS.md](INCIDENTS.md) if it affected users, availability, privacy, or spend.

## Rollback

- Prefer feature flags or config switches for beta/prod experiments.
- Stop beta/prod experiments when the rollback trigger fires, measurement is invalid, operational burden exceeds the stated value, or user trust, safety, privacy, cost, or availability regresses.
- Rollback criteria must include the owner who can stop the experiment, the switch or deploy action used to stop it, and the signal that confirms rollback worked.
- Record stopped experiments here instead of deleting them; the registry is lightweight shipped history.
