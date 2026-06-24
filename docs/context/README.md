# Context: Agent Orientation

Rekkus is a dish-first social food discovery app built with Expo React Native + Supabase. Users review dishes, save places, and follow friends to see their activity. The core product loop is: discover a dish → visit the place → post a review → friends see it in their feed.

## Five Domain Areas

| Domain | What it covers |
|---|---|
| **Places** | Venue data, status, stats, search index, ownership |
| **Users / Social** | Profiles, follows, blocks, trust, privacy modes |
| **Content** | Posts, dishes, reactions, comments, likes, collections |
| **Messaging** | Conversations, participants, messages, deliveries |
| **Collections** | User-curated lists of places |

## Layer Map

| Directory | What belongs here |
|---|---|
| `app/` | Expo Router file-based routes only — no logic |
| `features/` | Screen components; consume hooks and services via imports |
| `components/ui/` | Reusable primitives, no business logic |
| `lib/services/` | All Supabase / Google / third-party API calls |
| `lib/hooks/` | Reusable React hooks — call services, not Supabase directly |
| `lib/contexts/` | React providers — call services, not Supabase directly |
| `lib/types/` | DB-row type aliases and branded ID types |
| `types/domain.ts` | App-facing product types (richer than DB rows) |
| `types/database.ts` | Auto-generated — never edit |

## Where to Find Things

- **Branded types** → `lib/types/branded.ts`
- **DB schema** → `supabase/schema/` (source); `supabase/schema.sql` (generated artifact)
- **Product behaviour docs** → `product/`
- **Architecture decisions** → `docs/adr/`
- **Domain invariants** → `docs/domains/<domain>/invariants.md`
- **Security rules** → `docs/security/SECURITY.md`

## Critical Rules

- `supabase` must not be imported in `app/`, `features/`, `lib/hooks/`, or `lib/contexts/` — enforced by ESLint + `check:architecture`.
- Never edit `types/database.ts` or `supabase/schema.sql` — both are generated artifacts.
- Every new user-facing feature ships its analytics events in the same PR — no deferral.
- Never cast branded IDs directly (`id as PlaceId`) — use constructor functions (`asPlaceId(id)`).
- `follow_requests` and `follows` are separate tables — never conflate them.
- `social_events` rows are append-only except `read_at`; `analytics_events` are fully immutable.

## How to Navigate

- **Rules** → `AGENTS.md` (canonical operator guide)
- **Work queue** → `BACKLOG.md`
- **Where to put things** → `docs/context/ENTRYPOINTS.md`
- **Per-PR checklist** → `docs/context/SHIP_CHECKLIST.md`
- **Common mistakes** → `docs/context/GOTCHAS.md`
