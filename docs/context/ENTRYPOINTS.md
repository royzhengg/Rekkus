# Entrypoints

Decision tree: common agent tasks → where to start → what to touch.

## Adding a DB Column

1. Edit the appropriate file in `supabase/schema/` (never `supabase/schema.sql`).
2. Create a migration: `supabase/migrations/<timestamp>_add_<column>.sql`.
3. Regenerate types: `npm run gen:types` → updates `types/database.ts` automatically.
4. Update the type alias in `lib/types/<domain>.ts` if the column should surface in app types.
5. Update `docs/domains/<domain>/entities.md` if the column changes entity semantics.

## New Feature Screen

1. Create route file in `app/<path>/index.tsx` (Expo Router wrapper only).
2. Create screen component in `features/<domain>/<ScreenName>.tsx`.
3. Wire data via a hook in `lib/hooks/use<Name>.ts` that calls existing service functions.
4. If no suitable service function exists, add it to `lib/services/<domain>/queries.ts` or `mutations.ts`.
5. Add analytics events to `lib/analytics/events.ts` and call them in the screen.

## New Search Ranking Change

1. Read existing ranking logic in `lib/services/places.ts` search functions.
2. Document the new signal in `docs/domains/search/invariants.md` before changing weights.
3. Update the SQL query or RPC in `supabase/schema/` functions.
4. Add a migration and regenerate types.
5. Update `product/SEARCH.md` with the ranking change rationale.

## New Place Data Logic

1. Check `lib/services/places/queries.ts` and `lib/services/places.ts` for an existing function.
2. Add or extend in `lib/services/places/queries.ts` (reads) or `mutations.ts` (writes).
3. If it affects `place_stats`, remember stats are derived — update the aggregation, not the stats row directly.
4. Update `docs/domains/places/invariants.md` if a new invariant applies.

## New User / Social Feature

1. Check `lib/services/users.ts`, `lib/services/users/queries.ts`, `lib/services/users/mutations.ts`.
2. For follow-related work: review `docs/domains/users/lifecycle.md` before touching `follows` or `follow_requests`.
3. Add or update the hook in `lib/hooks/`.
4. If a social event should be raised, append to `social_events` (never update existing rows).

## New Notification Type

1. Add the notification type constant in `lib/services/notifications.ts`.
2. Create or update the Edge Function payload in `supabase/functions/send-push/`.
3. Ensure the notification references a `social_event` row — notifications are delivery-only.
4. Never drive business logic from the delivery status.
5. Update `product/NOTIFICATIONS.md`.

## New Analytics Event

1. Define the event name constant in `lib/analytics/events.ts`.
2. Call it in the feature screen in the same PR — never defer.
3. Document payload shape in `docs/analytics/EVENTS.md`.

## New Collection Feature

1. Check `lib/services/collections.ts`, `lib/services/collections/queries.ts`, `lib/services/collections/mutations.ts`.
2. Add hook in `lib/hooks/use<Name>.ts`.
3. Add screen in `features/collections/`.

## Architecture Decision

1. Create `docs/adr/ADR-<NNN>-<slug>.md` using the existing ADR format.
2. Link to it from `docs/context/CURRENT_STATE.md` if it affects active domains.
3. Note it in the relevant `docs/domains/<domain>/` file if it changes invariants.

## Adding a Reusable Component

1. If it has no business logic: `components/ui/<ComponentName>.tsx`.
2. If it coordinates multiple UI primitives but has no domain data: `components/<ComponentName>.tsx`.
3. If it fetches or mutates data: it is a feature component, not a UI primitive — put it in `features/`.
