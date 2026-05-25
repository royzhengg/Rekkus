# ADR 0011: Unified Platform Audit View

Status: Accepted  
Date: 2026-05-26  
Owner: Engineering

## Context

As the platform grew, domain-scoped audit tables were added independently:
`post_edit_events` (post edits), `dish_audit_events` (dish graph), `restaurant_audit_events`
(restaurant compliance), and `moderation_actions` (content moderation). Each table had its
own RLS policy and schema, with no single query surface for incident investigation, compliance
evidence gathering, or cross-domain correlation.

ISO 27001 A.12.4.1 also required a permanent, append-only authentication audit trail, and
there was no audit record for post or comment creation/deletion (the CASCADE FK in
`post_edit_events` made it structurally wrong for deletion events — the record would be wiped
with the post).

## Decision

1. **Add `auth_audit_events`** — ISO A.12.4.1-compliant authentication audit table (login,
   logout, OAuth, password change, account deletion). Append-only, service-role only.
   Written via `record_auth_audit_event` SECURITY DEFINER RPC from `AuthContext`.

2. **Add `content_lifecycle_events`** — post and comment creation/deletion audit table.
   `entity_id` carries **no FK** so records survive cascade deletes on the source entity.
   Written via `record_content_lifecycle_event` SECURITY DEFINER RPC.

3. **Create `platform_audit_events_view`** — UNION ALL view normalising all six domain audit
   tables to a common schema: `(id, source_table, entity_type, entity_id, user_id,
   event_type, context, created_at)`. Uses `SECURITY INVOKER` so source-table RLS applies
   automatically per caller.

4. **`check:audit` dynamic guardrail** — enforces at CI time that every table matching
   `*_audit_events`, `*_edit_events`, or `*_lifecycle_events` pattern (plus `moderation_actions`)
   is present in the view. Fails with the table name if a future developer adds an audit table
   without updating the view.

5. **Engineering rule in AGENTS.md** — new domains must ship an audit table and view arm
   together; SECURITY DEFINER RPC is the only write path; no CASCADE FK on `entity_id`.

## Consequences

- Compliance evidence for auth, content, dishes, moderation, and restaurant operations is
  now queryable from a single view via service-role.
- Auth events have permanent retention (not subject to the 90-day analytics_events deletion).
- Content deletion events survive the deletion of the source entity.
- Adding a new audit domain requires: new table + UNION ALL arm in one migration +
  `check:audit` automatically catches omissions.
- The view is read-only and does not add write paths or change source-table RLS.

## Alternatives Considered

- **Single `platform_audit_events` table**: Rejected — breaks domain-scoped RLS guarantees
  and append-only enforcement per domain; requires centralised insert routing which adds a
  single point of failure.
- **Materialized view**: Rejected — adds refresh scheduling complexity for a compliance
  surface queried rarely and not used for high-frequency ranking/trending reads.
- **Event sourcing / message bus**: Rejected — disproportionate operational overhead for the
  current scale; boring, observable, append-only tables are preferred per Execution Principles.

## Rollback Or Revisit Trigger

Revisit if: (a) query performance on the view becomes a bottleneck for compliance reporting,
in which case a materialized view with a scheduled refresh should be considered; or (b) the
number of arms exceeds ~12 and SQL maintenance becomes impractical, in which case a
dedicated compliance-audit microservice or append-only event stream should be evaluated.
