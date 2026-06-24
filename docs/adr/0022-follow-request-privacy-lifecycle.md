# ADR 0022: Follow Request And Privacy Lifecycle

Status: Accepted

Date: 2026-06-24

## Context

Private accounts use follow requests. Switching private accounts public while pending requests exist creates an ambiguous state unless the transition is explicit and transactional.

## Decision

Follow request lifecycle is owned by transactional `SECURITY DEFINER` RPCs. Approval creates the follow row, social event, notification delivery, and audit event atomically. Decline/cancel/block hides requests from Alerts and does not notify.

Switching private to public always warns the user. Confirming calls `set_account_privacy(false)`, which approves all still-pending incoming requests with `approval_source='auto_public'`.

## Consequences

- Public accounts do not retain pending incoming follow requests.
- Follower counts update through `follows` triggers.
- Privacy transitions have a durable audit trail.
- Bulk operations may need batching/backpressure as request volume grows.

