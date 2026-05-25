# Cost Governance

Owner: Operations

Cost governance keeps provider usage visible before spend becomes an emergency.

## Provider Register

| Provider | Primary cost driver | Review gate | Owner |
| --- | --- | --- | --- |
| Google Places | Autocomplete, details, and text-search calls | Beta/prod quota review | Engineering |
| Supabase | Database, auth, Edge Functions, storage, and egress | Migration and release review | Engineering |
| Resend | Transactional email volume | Release readiness review | Operations |
| Expo Push | Notification volume | Beta cohort review | Product |
| Storage | Uploaded media, variants, and CDN egress | Media release review | Engineering |
| AI | Summaries, automation, future ranking assistance | Feature launch review | Operations |
| Sentry | Crash/error event volume and source-map storage | Beta/prod release review | Engineering |

## Guardrails

- Provider calls should be deduped, cached, or rate-limited before high-traffic surfaces ship.
- Restaurant/search flows must use local Rekkus data before Google fallback.
- Google Place Details must use field masks; autocomplete must use session-token-aware flows when selection can follow.
- Provider cache entries must record TTL/freshness, attribution, source, retention, and cacheability.
- Provider usage events should track cache hit/miss, fallback reason, request type, feature, and estimated cost class.
- `operations/RELEASE.md` must include quota and cost review gates for beta and production.
- `npm run check:ops`, `npm run check:providers`, and `npm run check:compliance` validate provider coverage and release-gate language.
- Cost rows in `BACKLOG.md` stay open until a measurable guardrail or review surface exists.

## GIF Provider

**Decision (2026-05-22, ADR-0004):** Keep Giphy. GIF search is active in direct messages (`lib/services/gifs.ts`) and gated by the `gifSearch` feature flag so it can be disabled at runtime without a release.

**Tenor evaluation:** Tenor API v2 (2022+) requires a Google Cloud API key — it is not free without an API key as previously assumed. No net benefit over Giphy; migration cost > any gain.

**Kill switch:** Set `gifSearch: false` in `feature_flag_overrides` (Supabase) to hide the GIF button immediately without a release.

## Key Rotation

Google Maps, Google Places, and Giphy keys rotate annually, immediately after suspected exposure, and immediately after team/member/vendor access changes. Roy owns provider-console restrictions until evidence is recorded: iOS bundle/package restrictions for Maps, API restrictions and quota alerts for Places, and dashboard restrictions/rotation for Giphy. Rotation evidence belongs in the release note, current-state note, or incident note; secrets never belong in markdown.

## Review Cadence

- Weekly during beta: review provider dashboards and unexpected spikes.
- Before production: record quota owner, alert destination, and rollback trigger.
- After incidents: add a cost note to `operations/INCIDENTS.md` when provider limits or spend contributed.

## Media Cost Dashboard

Owner: Engineering until a dedicated operations owner exists.

Minimum dashboard requirements before public beta:

- Total Supabase Storage bytes by bucket, with post-media separated from avatars.
- Object count by bucket and media variant (`thumb`, `feed`, `full`, original if retained).
- Storage growth week over week and projected 30-day growth.
- CDN/egress volume when provider reporting is available.
- Upload volume, failed validation count, compression failure count, and cleanup deletion count.
- Largest objects and largest users by storage footprint for abuse/cost review.
- Alert threshold for unexpected storage or egress growth, with owner and response path.

Media cost review rules:

- Review weekly during beta and before any media-heavy launch.
- Investigate storage growth above 25% week over week unless explained by a planned cohort or launch.
- Do not add media variants without updating [../docs/security/MEDIA_PIPELINE.md](../docs/security/MEDIA_PIPELINE.md) and the dashboard requirements above.
- Track cleanup coverage so deleted and abandoned uploads do not become invisible recurring cost.

## API Cost Dashboard

Owner: Operations, with Engineering responsible for provider instrumentation.

Minimum API cost dashboard requirements before public beta:

- Google Places autocomplete/details fallback volume by feature and cache state.
- Google Maps, Google Places, and Giphy key rotation/restriction status.
- Supabase database, auth, Edge Function, storage, and egress usage.
- Resend transactional email volume for auth/support flows.
- Expo Push notification volume and failure rate.
- Provider quota owner, alert destination, and pause/rollback trigger.
- Top cost drivers by feature so local-first or caching fixes can be prioritized.

Review weekly during beta and before any feature that changes provider call volume.

## AI Cost Monitor

There is no runtime AI dependency in the product today. Before any AI-assisted product, ranking, moderation, or operations feature ships, the backlog item must name:

- Purpose and owner.
- Provider/model or tool.
- Budget or quota ceiling.
- Privacy and retention boundary.
- Human review path and deterministic fallback.
- `check:observability` coverage for the signal.

## Storage Growth Monitor

Storage growth is reviewed through the media cost dashboard and upload failure signals. Treat unexplained storage growth, repeated validation failures, or large-object concentration as release health risks until investigated.
