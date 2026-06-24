# Task Templates

Step-by-step checklists for common task types.

## 1. Add a DB Column

- [ ] Identify the owning schema file in `supabase/schema/`.
- [ ] Add the column with correct type, nullability, and default.
- [ ] Create migration: `supabase/migrations/<timestamp>_add_<col>_to_<table>.sql`.
- [ ] Run `npm run gen:types` to regenerate `types/database.ts`.
- [ ] Update type alias in `lib/types/<domain>.ts` if the column surfaces in app code.
- [ ] Add or update RLS policy in the migration if the column affects row-level access.
- [ ] Review migration for: data loss risk, lock risk on large tables, backfill need.
- [ ] Update `docs/domains/<domain>/entities.md` if entity semantics change.
- [ ] Run `npm run validate`.

## 2. Add a Feature Screen

- [ ] Create Expo Router wrapper: `app/<path>/index.tsx` (route only, no logic).
- [ ] Create screen: `features/<domain>/<ScreenName>.tsx`.
- [ ] Create hook: `lib/hooks/use<Name>.ts` — calls service functions only, no direct Supabase.
- [ ] Add any missing service functions to `lib/services/<domain>/queries.ts` or `mutations.ts`.
- [ ] Define analytics events in `lib/analytics/events.ts` (same PR — not deferred).
- [ ] Call analytics events from the screen (impression, primary action, exit).
- [ ] Add unit test: `tests/unit/features/<domain>/<ScreenName>.test.tsx`.
- [ ] Update `product/FEATURES.md` with the new screen behaviour.
- [ ] Run `npm run validate`.

## 3. Add a Search Signal

- [ ] Document the new signal and intended weight in `docs/domains/search/invariants.md` first.
- [ ] Locate the ranking SQL in `supabase/schema/` (search RPC or view).
- [ ] Add the signal column or join to the query.
- [ ] Create a migration for any schema changes.
- [ ] Run `npm run gen:types` if new columns are exposed.
- [ ] Ensure the signal is derived from source tables (not patched into the search index).
- [ ] Update `product/SEARCH.md` with rationale for the ranking change.
- [ ] Add search analytics tracking if a new query path is introduced.
- [ ] Run `npm run validate`.

## 4. Add a Notification Type

- [ ] Add the notification type constant to `lib/services/notifications.ts`.
- [ ] Create or extend the Edge Function payload handler in `supabase/functions/send-push/index.ts`.
- [ ] Ensure a `social_event` row is created before the notification delivery.
- [ ] Add the push token lookup and delivery insert in `supabase/functions/send-push/`.
- [ ] Verify the notification never drives business logic — delivery-only.
- [ ] Add analytics event for notification impression/tap (same PR).
- [ ] Update `product/NOTIFICATIONS.md` with the new type and trigger condition.
- [ ] Add type-safety test if the payload shape is complex: `tests/type-safety/`.
- [ ] Run `npm run validate`.
