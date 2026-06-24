# Ship Checklist

Per-PR requirements. Every item must be resolved before merge.

## Code Quality

- [ ] No `supabase` import in `app/`, `features/`, `lib/hooks/`, or `lib/contexts/`.
- [ ] No `as any`, `@ts-ignore`, `@ts-expect-error`, or non-null assertions (`!`) in runtime code.
- [ ] No `Database['public']['Tables']` outside `lib/types/` or `types/`.
- [ ] No direct branded ID casts (`id as PlaceId`) — use `asPlaceId(id)` etc.
- [ ] `npm run validate` passes (or `npm run validate:full` before PR handoff).

## Tests

- [ ] Unit tests cover new behaviour (`tests/unit/`).
- [ ] Type-safety tests added if new unsafe-input guards, Edge Function payload shapes, or provider parsing changed (`tests/type-safety/`).

## Analytics

- [ ] Analytics events for new user-facing behaviour are in this PR — not deferred to a follow-up.
- [ ] If analytics are legitimately omitted (migration, infra change, pure refactor): document why in the PR description.

## Documentation

- [ ] `BACKLOG.md` updated: shipped items marked done, discovered work inserted in right section.
- [ ] Domain docs updated if invariants or entity definitions changed (`docs/domains/<domain>/`).
- [ ] Architectural, security, or product docs updated per AGENTS.md Documentation Rules.
- [ ] If a durable architecture/provider/data/security decision was made: ADR created in `docs/adr/`.

## Migrations

- [ ] Migration reviewed for: data loss risk, lock risk on large tables, backfill requirement, RLS impact.
- [ ] Generated files regenerated if schema changed (`npm run gen:types`).
- [ ] `supabase/schema.sql` not manually edited.

## Risk

- [ ] Feature flag added for risky or incremental launches.
- [ ] Rollback path considered for irreversible operations (place merges, data deletions).
