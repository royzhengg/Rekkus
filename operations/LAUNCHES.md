# Launches

This doc owns lightweight launch tracking before a dedicated launch calendar exists.

## Launch Note Template

- Name:
- Owner:
- Target audience:
- Target date:
- Release dependency:
- Success signal:
- Rollback or pause trigger:
- Known risks:
- Follow-up backlog items:

## Rules

- Keep launches tied to actual user or operational value.
- Do not launch features that bypass release gates in [RELEASE.md](RELEASE.md).
- Move repeated launch work into automation only after the checklist is stable.

## App Store Review Tracking

App Store and Google Play review feedback is external, but it must stay close to execution.

| Field | Meaning |
| --- | --- |
| Build/version | Submitted app version and build number. |
| Store review status | Draft, submitted, rejected, approved, phased release, paused, or removed. |
| Reviewer feedback | Short summary only; do not copy private account data or credentials. |
| Owner | Person responsible for responding. |
| Backlog/incident link | Follow-up row or incident note when feedback requires work. |
| Resolution | Resubmitted, appealed, paused, or no action. |

Record store-review blockers in the current launch note or `operations/CURRENT_STATE.md` before resubmitting.
