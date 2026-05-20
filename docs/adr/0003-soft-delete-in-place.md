# ADR 0003: Soft Delete In-Place with Batched Purge

Status: Accepted
Date: 2026-05-18
Owner: Engineering

## Context

Rekkus needs a delete flow for posts and comments that:

1. Hides content from users immediately on deletion.
2. Allows a reversal window for moderation appeals (the `moderation_appeals` table already exists in the schema).
3. Satisfies GDPR Article 17 ("right to erasure without undue delay") — the deleted personal data must be physically removed, not just hidden.
4. Scales without requiring a schema change as row counts grow.
5. Prevents client-side hard-delete (which would bypass moderation audit trails and photo cascade).

The `deleted_at` columns and partial indexes already existed on `posts`, `post_photos`, and `comments` from migration 20240205 but were never enforced. This ADR records the enforcement approach adopted in migration 20240217.

## Decision

Use **soft delete in-place**: set `deleted_at = now()` on the existing row; enforce visibility via RLS SELECT policy (`using (deleted_at is null)`); physically purge rows older than 30 days via a batched pg_cron job.

Key properties:

- **RLS blocks hard-delete**: The `FOR ALL` policies that included `DELETE` are dropped and replaced with `INSERT + UPDATE` only. All deletes must go through `delete_post()` / `delete_comment()` SECURITY DEFINER RPCs.
- **Dual enforcement**: RLS filters at the database layer; service queries add `.is('deleted_at', null)` at the app layer so the query planner uses the existing partial indexes (`posts_not_deleted_idx`, `comments_not_deleted_idx`).
- **30-day retention**: Satisfies GDPR "without undue delay" while giving the moderation team a window to review appeals before content is gone.
- **Batched purge**: `purge_soft_deleted_content(batch_size int default 1000)` deletes in chunks to avoid long-running transactions, WAL spikes, and replication lag at scale.
- **Restore path**: `restore_post()` / `restore_comment()` are service-role-only RPCs that set `deleted_at = null`, enabling the `moderation_appeals` flow to actually restore content within the 30-day window.
- **Account deletion**: `ON DELETE CASCADE` on `user_id` provides immediate hard-delete of all user content on account removal — no soft delete for this path, satisfying the stricter account-level erasure requirement.

## Consequences

- Deleted rows accumulate for up to 30 days before physical removal. Partial indexes keep this transparent to queries.
- pg_cron must be enabled in Supabase dashboard before the purge schedule takes effect. If not enabled, the function exists but is unscheduled; content will accumulate until the schedule is registered.
- Restoring content requires service-role access — not exposed to any app client.
- Adding a new table that stores user-generated content requires: (a) a `deleted_at` column, (b) a partial index `where deleted_at is null`, (c) a RLS SELECT policy with `deleted_at is null`, (d) a soft-delete RPC, and (e) adding the table to `purge_soft_deleted_content()`.

## Alternatives Considered

- **Archive table**: Move deleted rows to `deleted_posts` / `deleted_comments` tables on deletion. Pros: main tables contain only live content, no filter needed in queries. Cons: FK complexity, triggers or dual INSERT+DELETE RPCs, complicates every join that touches deleted content for admin views. Rejected as over-engineered for current scale.
- **Immediate hard-delete via RPC**: Skip soft delete entirely; let moderation capture a snapshot before deleting. Cons: no restore path, GDPR erasure is immediate but loses the appeals window; moderation cannot recover accidentally actioned content. Rejected.
- **View-based filtering**: Create a `live_posts` view with `where deleted_at is null` and redirect all queries there. Cons: adds a view layer, Supabase JS PostgREST queries use table names not view names without extra config, RLS still needs to be set on the base table. Rejected as unnecessary complexity.

## Rollback Or Revisit Trigger

Revisit if:
- Post/comment volume exceeds ~50M rows and the nightly purge batch runs longer than 10 minutes even at batch_size=1000.
- A legal jurisdiction requires a retention period shorter or longer than 30 days.
- An admin dashboard requires rich access to soft-deleted content beyond what the base tables support (at that point, an audit archive table may be worth the complexity).
