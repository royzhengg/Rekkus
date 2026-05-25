# Repo Map

Use this file to navigate Rekkus quickly.

## Source Of Truth

- Strategy: `PRODUCT.md`
- Execution: `BACKLOG.md`
- Agent behavior: `AGENTS.md`
- Architecture: `docs/architecture/ARCHITECTURE.md`
- Engineering governance: `docs/architecture/ENGINEERING_GOVERNANCE.md`
- Security: `docs/security/SECURITY.md`
- Documentation governance: `docs/GOVERNANCE.md`
- Durable decisions: `docs/adr/README.md`
- Release: `operations/RELEASE.md`
- Observability/crashes: `operations/OBSERVABILITY.md`, `lib/services/crashReporting.ts`
- Feature flags: `operations/FEATURE_FLAGS.md`, `lib/featureFlags.ts`, `supabase/functions/feature-flags`
- Product behavior: `product/README.md`, `product/FEATURES.md`, `product/SEARCH.md`, `product/FEED.md`
- Design: `design/README.md`, `design/DESIGN_SPEC.md`, `design/UI_LIBRARY.md`, `design/UX_Copywriting_Guide.md`
- Analytics behavior: `docs/analytics/ANALYTICS.md`, `lib/analytics.ts`, `supabase/functions/analytics-retention`

## Code Ownership

- `app/`: Expo Router wrappers and route groups.
- `features/`: screen implementations by product area.
- `components/ui/`: reusable UI primitives.
- `components/`: reusable app components.
- `lib/contexts/`: app providers.
- `lib/hooks/`: reusable state/data hooks.
- `lib/services/`: Supabase, Google, Expo, and network boundaries.
- `lib/dataSources/`: runtime data-mode boundaries.
- `lib/mocks/`: demo data only.
- `lib/utils/`: pure helpers.
- `constants/`: design tokens.
- `types/`: domain and generated database types.
- `supabase/`: migrations and Edge Functions.
- `scripts/`: local guardrails and maintenance checks.

### Post Create

- **Components**: `components/post-create/StepMedia.tsx`, `components/post-create/StepDetails.tsx`, `components/post-create/StepReview.tsx`
- **Hooks**: `lib/hooks/useRestaurantSearch.ts` (debounced DB+Google autocomplete, nearby fetch, place details + upsert orchestration)
- **Services**: `lib/services/restaurants.ts`, `lib/services/media.ts`, `lib/services/postMediaProcessing.ts`

### Direct Messaging

- **Screens**: `features/messages/ConversationScreen.tsx`, `features/messages/MessagesListScreen.tsx`, `features/messages/MessageRequestsScreen.tsx`, `features/messages/ConversationInfoScreen.tsx`, `features/messages/CreateGroupScreen.tsx`
- **Routes**: `app/messages/[conversationId].tsx`, `app/messages/index.tsx`, `app/messages/requests.tsx`, `app/messages/new-group.tsx`, `app/messages/info.tsx`
- **Services**: `lib/services/messaging.ts` (send, fetch, delete, reactions, requests, mute, archive, pin, search, forward, group mutations), `lib/services/messageAttachments.ts` (upload/delete storage files)
- **Hooks**: `lib/hooks/useUnreadMessageCount.ts`
- **Edge Function**: `supabase/functions/moderate-content/index.ts` (CSAM hash check, keyword filter, spam rate limiting)
- **Storage bucket**: `message-attachments` (private; participant-only RLS)
- **Product owner**: `product/MESSAGING.md`

## Common Changes

- Add a screen: route wrapper in `app/`, implementation in `features/`.
- Add reusable choice UI: use or extend `components/ui/RekkusActionSheet`.
- Add Supabase call: create or extend a `lib/services/*` function.
- Add Google Places call: route through `lib/services/googlePlaces.ts`.
- Add or change an owner boundary: update `docs/architecture/ENGINEERING_GOVERNANCE.md`.
- Add product behavior: update `product/FEATURES.md` and the relevant domain doc.
- Add design/component/copy behavior: update the relevant doc in `design/`.
- Add risky backend/security behavior: update `docs/security/SECURITY.md`, `operations/RELEASE.md`, and `BACKLOG.md`.
- Add crash/error behavior: update `operations/OBSERVABILITY.md`, `docs/architecture/ARCHITECTURE.md`, and Sentry release/source-map checks.
- Add analytics behavior: update `docs/analytics/ANALYTICS.md`, `lib/analytics.ts`, and retention/versioning checks.
- Add a durable architecture/provider/data/security decision: create an ADR in `docs/adr/`.
- Add discovered work: insert it into `BACKLOG.md` by priority and section.

## Current Architecture Direction

- iOS and Android are first-class.
- Web is best-effort.
- `app.config.js` owns native identity and environment-specific config.
- `EXPO_PUBLIC_DATA_MODE=live` is required for beta and production.
- Google should become enrichment, not serving infrastructure.
- Supabase RLS remains the primary authorization layer.
- Future top-level folders from the master plan stay future until `docs/architecture/ENGINEERING_GOVERNANCE.md` says a real boundary exists.
