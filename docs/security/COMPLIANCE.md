# Compliance

Owner: Security / Operations

This is the app-wide owner doc for legal, privacy, provider, audit, and ISO-readiness controls. It is not legal advice and does not claim certification; it records the controls Rekkus must keep current before shipping data, provider, analytics, release, media, auth, notification, ranking, moderation, or admin changes.

## Principles

- Rekkus-owned first-party data is the long-term serving truth.
- Provider data is enrichment or fallback and must keep source, terms, attribution, cacheability, retention, and deletion/export rules.
- Every risky feature needs a Compliance Impact review before release.
- User-generated content must have report, block, moderation, dispute, and takedown paths before public app-store release.
- Location access must be contextual, optional where practical, and minimized; precise GPS must not enter analytics or be retained beyond active feature need without explicit review.
- User-visible AI output must be disclosed, and AI moderation must be first-pass flagging only until human review, appeals, and provider boundaries are documented.
- Every meaningful mutation needs an audit trail or a documented reason it is low risk.
- Compliance evidence must be reproducible through repo docs, migrations, checks, and operational reports.

## Compliance Impact Template

Use this block in risky backlog rows, ADRs, release notes, and owner docs:

| Field | Required answer |
| --- | --- |
| Data collected | Tables, events, files, provider payloads, media, or SDK data. |
| Source | User, behavior, owner, admin, Google, OSM, Supabase, Expo, Resend, storage, AI, or future provider. |
| Purpose | Product, security, legal, analytics, ranking, cost, support, or abuse prevention reason. |
| User visibility | Public, user-private, internal, admin-only, or provider-visible. |
| Retention | Permanent, account lifetime, cache TTL, audit retention, aggregation window, or manual review. |
| Deletion/export | Included, excluded with reason, aggregated/de-identified, or provider-managed. |
| Third parties | Provider, SDK, processor, or subprocessors involved. |
| Provider terms | Cacheability, attribution, display, API, and retention restrictions. |
| Security/RLS | Access model, RLS policy, service-role path, and rate limit. |
| Audit trail | Event/table/script that records mutation, review, or release evidence. |
| Store disclosure | Apple App Store privacy details and Google Play Data Safety impact. |
| Rollback | Kill switch, revert, roll-forward, provider disablement, or data repair path. |

## Data Inventory

| System/table | Owner | Sensitivity | Source | Retention | Deletion/export | Access model |
| --- | --- | --- | --- | --- | --- | --- |
| users | Product | User profile | User | Account lifetime | Included in deletion/export | Public select, owner mutation |
| user_settings | Product | User-private settings, including media autoplay preference | User | Account lifetime | Included | Owner RLS |
| posts | Product | Public app data | User | Account lifetime unless deleted | Included where user-owned | Public select, owner mutation |
| post_photos | Product | Public media | User | Account lifetime unless deleted | Included as URLs/metadata | Public select, owner mutation |
| post_edit_events | Security | Audit evidence | System/user action | Compliance audit retention | Minimized audit rows; not normal public export | Owner insert/select via RLS |
| post_drafts | Product | User-private draft content | User/autosave | Account lifetime unless discarded/published cleanup | Included for owner; autosaves recovery-only | Owner RLS |
| post_draft_media | Product | User-private draft media metadata | User/autosave | Follows draft lifecycle; cleanup job pending | Included for owner | Owner RLS plus private storage policies |
| hashtags | Product | Public taxonomy | User/system | Retained while referenced | Not user-private | Public select, authenticated insert |
| post_hashtags | Product | Public post metadata | User | Follows post lifetime | Included through posts | Public select, owner mutation |
| places | Product/Data | Canonical public place data | Rekkus/user/provider/admin | Retained while place exists | Not user-owned except submitted observations | Public select, controlled mutation |
| dishes | Product/Data | Canonical public dish-at-place identity | Rekkus/user/post backfill | Retained while referenced | Not user-private | Public select, authenticated creation through bounded workflow |
| dish_audit_events | Security | Dish canonicalisation audit evidence | System/user workflow | Compliance audit retention | Minimized; not normal public export | Direct client access denied; internal review |
| cuisine_aliases | Product/Data | Public taxonomy | Rekkus/system | Retained while search taxonomy exists | Not user-owned | Public select, migration/admin write |
| suburb_aliases | Product/Data | Public local discovery taxonomy | Rekkus/system | Retained while local search taxonomy exists | Not user-owned | Public select, migration/admin write |
| suburb_lookups | Product/Data | Public locality lookup metadata | Public/open locality data and admin seed | Retained while local search taxonomy exists | Not user-owned | Public select, migration/admin seed |
| place_popularity_cache | Analytics/Data | Aggregate place engagement signal | Derived from public posts and privacy-safe events | Refreshed aggregate cache | Aggregated/de-identified | Public select, service refresh |
| trending_searches | Analytics | Aggregate discovery signal, partitioned by coarse city | Derived from privacy-safe search events | Refreshed aggregate cache | Aggregated/de-identified | Public select, service refresh |
| saved_searches | Product/Search | User-private saved query text | User | Account lifetime unless unsaved | Included in deletion/export | Owner RLS |
| restaurant_sources | Data | Source/provenance | Provider/user/admin | Retain while linked | Source-attributed; unlink by review | Public select, limited insert |
| restaurant_provider_cache | Data | Provider-derived cache | Google/OSM/future provider | TTL/terms based | Provider-terms governed | Public select, service writes |
| restaurant_observations | Data/Trust | First-party facts | User/behavior/post/save/search | Account lifetime or superseded | User-linked rows included | Trusted public or owner select |
| restaurant_aliases | Data/Trust | Canonicalization metadata | Admin/system/user report | Retained for duplicate history | Audit-retained | Public select, controlled write |
| restaurant_audit_events | Security | Audit evidence | System/admin/service | Compliance retention | Minimized; not normal export | Authenticated/internal review |
| restaurant_ownership_events | Data/Trust | Ownership claim/transfer evidence | Owner/admin/user report | Audit retention | Audit-retained | Authenticated review, limited claim insert |
| restaurant_merge_events | Data/Trust | Merge history | Admin/system | Audit retention | Audit-retained | Authenticated review, service/admin write |
| data_repair_events | Data/Trust | Repair reports | User/admin/system | Audit retention or superseded | User-linked rows included where appropriate | Owner report select/insert, service/admin review |
| user_blocks | Trust/Safety | User-private block graph | User | Account lifetime unless unblocked | Included for blocker | Owner RLS |
| content_reports | Trust/Safety | Moderation queue intake | User/support/system | Manual review/audit retention | Reporter-linked rows included where appropriate | Reporter insert/select, admin/service review |
| moderation_actions | Trust/Safety | Moderation decision audit | Admin/system/service | Audit retention | Minimized; not normal export | Reporter-related select, admin/service write |
| moderation_appeals | Trust/Safety | Appeal record | User/admin | Manual review/audit retention | Appellant-linked rows included | Appellant insert/select, admin/service review |
| user_trust_profiles | Trust/Safety | Private trust/restriction state | System/admin | Account lifetime or review expiry | Included where user-linked | Owner select, admin/service write |
| privacy_requests | Security | User-private legal request | User/support | Legal retention | User visible | Owner RLS |
| analytics_events | Analytics | Internal telemetry, including coarse search `near_city`, search/provider fallback outcomes, create-post place search queries, no-results recovery queries, optional cuisine metadata, and search-attribution metadata (`search_session_id`, capped query, result type/position) when available | User behavior/system | 90-day raw retention, aggregate later | De-identify or delete link when required | Insert own, aggregate/public read |
| feature_flag_overrides | Operations | Emergency feature flag rollback state | Engineering/admin | Until flag retirement or incident closure | Internal only | Service-role only |
| feature_flag_audit_events | Security/Operations | Feature flag change audit evidence | Database trigger on runtime overrides | Compliance audit retention | Minimized; not normal export | Service-role only |
| saved_search_audit_events | Security/Search | Saved search mutation audit evidence without raw query text | Database trigger on saved_searches | Compliance audit retention | Minimized; not normal export | Service-role only |
| user_top_spots_audit_events | Security | Top spot set/removed/reordered audit evidence | SECURITY DEFINER RPC `record_top_spot_audit_event` | Compliance audit retention | Minimized; not normal export | Service-role only; no direct client access |
| Device-local pending intents (`rekkus:pending-mutations:v1`) | Product | User-private transient identifiers, target state, and optional cuisine label for post-save analytics replay | User action while offline/transport failure | 7-day TTL max; removed on sync completion, non-retryable failure (including after 5 retries), sign-out, or app-data removal | Cleared locally; server remains source of truth | Device `AsyncStorage` only; active-user scoped replay; Phase 2 mutations (message reactions, conversation prefs) deferred to B-239b |
| osm_import_runs | Operations/Data | OSM import run provenance — state, start/end time, counts, report | System/admin (OSM import script) | Retained while import history required | Not user-owned or personal | Service-role only |
| place_contact | Product/Data | Venue contact details — phone, website, social URLs | OSM/owner/community | Retained while place exists | Not user-personal; owner-submitted rows included in correction requests | Public select, service/owner write |
| place_features | Product/Data | Venue capability flags — wheelchair, dietary, payments, seating | OSM/owner/community enrichment | Retained while place exists | Not user-personal | Public select, service/owner write |
| place_provider_metadata | Data | Raw provider metadata — OSM tags, brand, description, alt names | OSM/Google import pipelines | Retained while place exists; raw_osm_tags archive only | Provider-terms governed; never expose raw_osm_tags to clients directly | Public select, service-role write |
| place_stats | Analytics/Data | Derived aggregate signals — post count, save count, trending score | Derived from posts/saves/collections; event sources are truth | Refreshed aggregate cache; rebuild from events if drifts | Aggregated/de-identified | Public select, service refresh |
| place_aliases | Product/Data | Venue name aliases for search quality | OSM/community/admin/cuisine taxonomy | Retained while place exists | Not user-personal | Public select, service/admin write |
| place_traits | Product/Data | Community-inferred venue vibes — date_night, cheap_eats, etc. | Community/admin/AI | Retained while place exists | Not user-personal; source tracked | Public select, service/admin write |
| place_merge_log | Data/Trust | Deduplication merge history | Admin/system | Audit retention | Audit-retained; old_place_id is not a FK by design | Service-role only |
| place_sources | Data | Raw provider payloads for provenance and future re-derivation | OSM (always), Google (on user-tap only), owner/user/admin | Retained while place exists; selective retention per source | Provider-terms governed; osm=always, google=event-driven only | Service-role only |
| place_opening_hours | Product/Data | Venue opening hours by source | OSM/Google/owner/community | Retained while place exists; source priority: owner > community > google > osm | Not user-personal | Public select, service/owner write |
| search_analytics | Analytics | Search query text, result counts, clicked place, coarse location | User action | 90-day raw retention, aggregate later | Query text retained; user_id nullable; no precise coordinates stored permanently | Users read own rows, insert own; service-role full access |

### B-529 Compliance Impact Review

- Data added: `user_settings.autoplay_videos`, a user-private boolean appearance preference retained for the account lifetime and included in deletion/export.
- Collection/provider impact: none; video playback uses existing public post media and adds no media upload, analytics route, external provider, or location access.
- Security/RLS: the field remains within existing owner-RLS `user_settings`; no new mutable entity domain or audit table is introduced.
- Rollback: disable the UI/autoplay eligibility path and retain or later drop the additive preference column through a follow-up migration.

### B-550 Compliance Impact Review

- Data added: optional coarse `near_city` in `search_query` analytics metadata and aggregate `trending_searches.near_city` partitions; no precise coordinates are written to analytics.
- Collection/provider impact: city is resolved from existing place rows near already-known user coordinates; no new external provider call, permission prompt, or location storage path is introduced.
- Security/RLS: raw analytics retention remains 90 days; `trending_searches` stays aggregate/public-read and does not expose individual searchers.

### B-553 Compliance Impact Review

- Data added: `saved_searches` stores user-private saved query text and `saved_search_audit_events` stores mutation evidence without raw query text.
- Collection/provider impact: no new external provider call or location permission path; saved query actions reuse existing search execution.
- Security/RLS: saved searches use owner RLS; audit rows deny direct client access and are included in `platform_audit_events_view`.
- Rollback: keep global rows and disable passing `near_city` from SearchScreen; city partitions can be ignored or dropped in a follow-up migration.

### B-575 Compliance Impact Review

- Data added: downstream post/place/dish view and save analytics can include search-attribution metadata: `search_session_id`, capped query, result type, and result position. (`place_id` replaces `restaurant_id` in attribution metadata)
- Aggregate surface: `get_search_quality_metrics` returns daily counts/rates only; no user IDs, raw result payloads, result names, provider payloads, addresses, exact coordinates, or per-session rows.
- Collection/provider impact: no new provider call, permission, table with mutable user state, or persistent location store.
- Security/RLS: raw analytics retention remains 90 days; the RPC is aggregate-only and bounded to a maximum 90-day lookback.
- Rollback: stop passing attribution route params and ignore already-written metadata until raw analytics retention expires.

### B-572/B-576/B-578/B-579/B-580 Compliance Impact Review

- Data added: none. Search reads existing saved places/posts/dishes, recent search event metadata, dish/post/place links, and de-identified trending aggregates.
- Cache impact: autocomplete and full-search result caches are process-memory only, bounded to 50 entries, and expire after 60s/30s respectively; no AsyncStorage or server persistence is added.
- Collection/provider impact: no new provider API call, location permission path, raw result payload storage, precise-coordinate storage, or new analytics event field.
- Security/RLS: personalization reads owner-scoped rows through existing RLS/service boundaries; trending and dish graph evidence use aggregate/public content links only.
- Rollback: bypass the in-memory caches and stop attaching `graphEvidence`, `personalizationReasons`, and `trendingScore` metadata to `SearchCandidate` rows.

### B-409 Compliance Impact Review

- Data accessed: device-local photo-library thumbnails via Expo MediaLibrary after OS permission; no files, URLs, EXIF, location, or asset IDs are sent to Rekkus until the user taps a photo.
- Collection/provider impact: selected media continues through the existing post media preparation/upload path; new analytics records only strip display/selection counts and never photo URIs or filenames.
- Security/RLS: no new database table, storage bucket, provider cache, or mutable backend entity is introduced.
- Rollback: remove the recent-photo strip and MediaLibrary permission path; existing image picker and camera flows continue to work.

### B-411 Compliance Impact Review

- Data added: create-post place search query text, zero-result search query text, selected place ID/source, optional place ID/cuisine, and a skipped-field event.
- Collection/provider impact: no new provider call, permission, table, or location metadata path; query text follows the existing analytics sanitizer and 90-day raw retention.
- Security/RLS: events use the existing `analytics_events` insert-own policy and sanitized metadata allowlist; no precise coordinates, addresses, provider payloads, or media data are recorded.
- Rollback: remove the four analytics helper calls and ignore any already-written event types until raw retention expires.

### B-569 Compliance Impact Review

- Data added: search and place-tagging provider fallback outcomes, query intent, fallback reason, location context boolean, coarse location source (`gps`, `manual`, `none`), and permission-result status.
- Collection/provider impact: no new provider integration, table, background location, or persistent location store. Provider calls are reduced for ambiguous food queries without locality.
- Security/RLS: events use existing `analytics_events` insert-own policy and sanitized metadata allowlist; no precise coordinates, manual area labels, addresses, provider payloads, or raw result payloads are recorded.
- Rollback: remove the fallback/nudge analytics helper calls and retain already-written event types until raw retention expires.

### 2026-06-12 Location Tagging Flywheel Compliance Impact Review

- Data added: no new table. Create-post place tagging requests more local DB candidates and may call Google only to top up eligible thin local result sets.
- Provider impact: displayed autocomplete suggestions remain transient. A user-selected Google result is promoted through the existing compliant path: canonical `places`, Google `place_id` in `restaurant_sources`, field-mask-limited `restaurant_provider_cache`, attribution/cacheability/retention metadata, and `restaurant_audit_events`. Note: `restaurant_sources`, `restaurant_provider_cache`, and `restaurant_audit_events` retain historical naming.
- Privacy impact: no raw provider payloads, precise coordinates, full addresses, or unrestricted result lists are added to analytics. The new fallback reason is bounded metadata: `thin_local_results`.
- Retention/legal posture: Place IDs are durable provider identifiers; broader Google content remains provider-cache governed and stale/refresh controlled. Google stays fallback/enrichment, not primary Rekkus-owned truth.
- Rollback: restore the previous local-result threshold and visible cap in `useRestaurantSearch`; already-selected places remain source-attributed local graph records.

### 2026-06-12 Profile Food Identity Compliance Impact Review

- Data added: no new table or new provider integration. Profile interactions add bounded analytics metadata for tab selection, top-spot taps, share taps, and empty-profile post CTAs.
- Provider impact: Top Spots photo cards reuse existing place photo helpers, preferring Rekkus post photos and then cached/provider photo refs already stored under the place provider-cache governance path.
- Privacy impact: analytics records action labels and optional profile tab only; place names, collection names, profile text, cuisine labels, addresses, precise coordinates, and follower names are not recorded.
- Security/RLS: profile lists use existing collection RLS through the service layer; public profiles request only `unlisted`/`public` collections, while private topic follows remain out of the public profile identity surface.
- Rollback: remove `profile_interaction` calls and keep the food-first profile UI; already-written events expire under the existing analytics raw-retention policy.

| saved_places | Product | User-private saved place intent | User | Account lifetime | Included | Owner RLS |
| saved_dishes | Product | User-private canonical dish intent | User | Account lifetime | Included | Owner RLS |
| collections | Product | User-private/shareable collection metadata | User | Account lifetime unless deleted | Included | Owner RLS; unlisted/public select |
| collection_items | Product | User-private/shareable dish/post/place organisation in Collections | User | Account lifetime unless deleted | Included | Owner RLS via collection; unlisted/public select; atomic add/confirmed unsave RPCs |
| user_topic_follows | Product | User-private taste/interest preference | User | Account lifetime unless deleted | Included | Owner RLS |
| conversations | Product/Messaging | Private conversation container | User | Account lifetime unless deleted | Included | Participant RLS |
| conversation_participants | Product/Messaging | Private conversation membership and read state | User | Account lifetime unless deleted | Included | Participant RLS |
| messages | Product/Messaging | Private message body | User | Account lifetime unless deleted; body + attachment nulled immediately on user delete (true erasure) | Included | Participant RLS; sends through block-aware RPC |
| message_reactions | Product/Messaging | Emoji reactions on messages | User | Account lifetime unless deleted | Included | Participant RLS |
| message_deliveries | Product/Messaging | Per-message delivery and read state | User | Account lifetime unless deleted | Included | Participant RLS |
| conversation_pinned_messages | Product/Messaging | Pinned message references per conversation | User | Account lifetime unless deleted | Included | Participant RLS |
| message-attachments (storage) | Product/Messaging | Photos, videos, audio, files in DMs | User | Deleted on message delete or account delete (purged within 24h via cron) | Included | Participant RLS via storage policies |
| likes | Product | Public/user-linked social signal | User | Account lifetime unless deleted | Included where user-owned | Existing RLS |
| saves | Product | User-private saved intent | User | Account lifetime unless deleted | Included | Owner RLS |
| follows | Product | Public/user-linked graph | User | Account lifetime unless deleted | Included where user-owned | Existing RLS |
| comments | Product | Public app data | User | Account lifetime unless deleted | Included where user-owned | Public select, owner mutation |
| post_reactions | Product | Public/user-linked social signal | User | Account lifetime unless deleted | Included where user-owned | Existing RLS |
| push_tokens | Notifications | User-private | Device/user | While valid | Included/delete on account deletion | Owner/service access |

## Provider Register

| Provider | Purpose | Terms/rights class | Cacheability | Attribution | Cost guard | Kill switch |
| --- | --- | --- | --- | --- | --- | --- |
| Google Places | Fallback autocomplete/details/text search | Restricted provider_google | Place IDs durable; selected-place content only through field-mask/provider-cache rules; raw autocomplete predictions are not permanent app data | Required when displaying Google-derived content | Field masks, session tokens, dedupe, cache, quota monitor | Disable fallback in provider gateway |
| Google Maps | Map rendering | Restricted maps provider | Do not treat tiles/map content as restaurant data | Required by SDK/platform | Key restrictions and quota review | Disable map-dependent surfaces or switch provider |
| OpenStreetMap | Active — place database seed (AU, ~80k–200k venues) + weekly delta refresh | open_osm / ODbL | "© OpenStreetMap contributors" attribution required on map/address display; ODbL allows commercial use; ADR-021 | Required when displaying OSM-sourced place data | `canonical_source = 'osm'` on imported rows; attribution string in all place detail screens | Delta refresh (`scripts/admin/osm/delta.ts`) never overwrites `community_verified`/`owner_verified` rows — logs delta to `restaurant_audit_events` only. Full kill switch: remove `osm-delta-refresh` from cron schedule in `operations/JOB_MANIFEST.md`. |
| Supabase | Database/auth/storage/functions | Processor/platform | App data storage owner rules | Not user-visible attribution | Release quota/storage review | Feature flags, rollback, backups |
| Expo | Builds, push, device APIs | SDK/platform | Push token/device handling only as needed | Store disclosure as needed | Beta cohort review | Disable push/feature flag |
| Resend | Transactional email | Processor/provider | Email event retention by provider | Privacy policy disclosure | Volume review | Disable email feature or provider |
| Storage | Media hosting | First-party/user media | Account/media retention | Rekkus media ownership/source rules | Storage growth review | Upload kill switch |
| AI | Future summaries/automation | Future provider | No user-private payloads without ADR | Disclosure as needed | Feature launch review | Feature flag |

## Privacy Rights

- Privacy Policy and Terms links must be real before beta or production: `https://rekkus.com/privacy` and `https://rekkus.com/terms`.
- Account deletion and data export must be available in-app or clearly routed through `privacy@rekkus.com` before beta.
- Privacy requests are tracked in `privacy_requests` with status, due date, owner, completion, and audit evidence.
- Exports include user-owned content and meaningful metadata where practical.
- Deletion covers profile, settings, push tokens, user-owned observations, saves, and private linkage where legally/product-appropriate.
- Audit/security records may be retained only when minimized and justified.
- Precise location, raw free text, emails, phone numbers, secrets, tokens, reset links, private notes, and raw provider payloads must not enter analytics unless explicitly reviewed.
- Analytics metadata is sanitized in `lib/analytics.ts` before insertion and checked by privacy/compliance automation; no-results suggestion lists are stored as compact query strings, not raw result payloads.
- Post edit audit data is minimized to changed field names/count. Do not store raw captions, media URLs, place names, addresses, report notes, or before/after content in `post_edit_events`.

## Location Minimization

- Search and Places must not request GPS on mount; permission is requested only after a user taps a location-powered control.
- Manual suburb/postcode fallback is allowed for search ranking and provider biasing without requiring GPS permission.
- `B-524` enforces this contract in `useUserLocation` and `check:risk-guardrails`, with a unit test confirming no foreground location request occurs on mount.
- Precise coordinates are held in app memory for active ranking/map/post-visit flows and are not inserted into analytics metadata.
- Manual area labels may be shown in UI, but analytics should record only feature outcome/source fields, not exact coordinates or full addresses.
- Persistent precise location, background location, or location history needs a DPIA/PIA and release review before shipping.

## Retention Policy

| Data | Retention rule | Deletion/export |
| --- | --- | --- |
| Auth identities and profile data | Account lifetime unless deleted | Included in account deletion/export where user-owned |
| Posts, comments, reactions, follows, saves, saved places | Account lifetime unless deleted or moderated | Included where user-owned |
| Public post media | Account lifetime unless post/media is deleted | URLs/metadata included; storage cleanup follows media lifecycle |
| Offline saved cache | Device-local best-effort cache, overwritten on refresh | Cleared by app/device data removal; server deletion remains source of truth |
| Offline pending intents | Device-local reversible mutation IDs/state only, until replay or session clearing | Cleared after sync, non-retryable rejection, sign-out/account removal, or app/device data removal |
| Analytics events | Time-window review for raw events, aggregate later where practical | Delete/de-identify user link when required; no precise location or secrets |
| Moderation reports, actions, appeals, trust state | Manual review/audit retention | User-linked records included where appropriate; audit records minimized |
| Privacy requests and security incidents | Legal/audit retention | Minimized and retained when justified |
| Provider cache | Provider terms and TTL/freshness policy; Place IDs may be retained as provider identifiers | Governed by provider terms and source attribution |
| Messages (body + attachment) | Soft-deleted on user request; body and attachment_url nulled immediately for true erasure; storage file purged within 24h via cron job | Message row retained with deleted_at for audit and moderation continuity |

### B-239 Compliance Impact Review

- Data added: device-local versioned pending-intent records containing authenticated user ID, entity ID, mutation domain, target state, and timestamps only.
- Excluded data: post/comment/message text, attachments, profile/auth values, report/block details, and publishing payloads are never stored or replayed by this queue.
- Retention/deletion: completed and non-retryable records are removed; pending records for an account are cleared on sign-out/account removal; device/app data removal also clears them.
- Analytics: `offline_mutation_sync` records only mutation domain and queued/synced/failed outcome under existing raw-event retention.
- Provider/database impact: `expo-network` reports device connectivity only; no database migration, new mutable backend entity, or provider payload storage is introduced.

## CSAM / Media Safety

Rekkus checks all image and video attachments in direct messages against a CSAM hash blocklist before the message is stored. Detected content is blocked, quarantined, and reported to NCMEC via the CyberTipline API. Rekkus is a registered NCMEC Electronic Service Provider. Text messages are screened against a keyword blocklist for grooming/solicitation language. Violations are logged in `content_reports` with type `csam_detected`.

Message deletion provides true erasure: `messages.body`, `attachment_url`, and `attachment_metadata` are set to NULL at delete time, not merely flagged. Attachment files are removed from the `message-attachments` storage bucket by a background job within 24 hours. The message row itself is retained with `deleted_at` set for audit and moderation continuity. Account deletion cascades to all message participant records; body and attachment fields are nulled before the account row is removed.

## UGC, Reviews, And Ranking

- Report and block flows are release-critical for posts, comments, profiles, and other user-generated content.
- Moderation actions must be auditable, reversible where practical, and reviewable by a human for borderline or legally risky content.
- Review incentives, paid placement, or place-owner influence must be disclosed before the content or ranking surface is shown to users.
- Place and user disputes need an intake path, status trail, owner, and SLA; negative posts must not be selectively removed for commercial reasons.
- Takedown requests need a monitored contact path and documented response SLA before public launch.
- Ranking documentation may explain main factors without exposing exact weights; ranking changes must keep timestamped evidence in product owner docs.

## Privacy Risk Reviews

Use a lightweight DPIA/PIA before shipping features that introduce AI, profiling, persistent precise location, sensitive data, large-scale monitoring, or materially new provider disclosure.

Minimum review fields: purpose, data collected, necessity, user visibility, retention, deletion/export, provider/subprocessor, risk to users, mitigation, human approver, audit evidence, and rollback.

Use the DPIA/PIA checklist before enabling AI moderation, profiling, persistent precise location, sensitive data processing, large-scale monitoring, payment/restaurant monetization, or material new provider disclosure.

## Additional Info Triage

`Additional Info.md` was reviewed end to end. Each section is treated as follows:

| Section | Disposition | Rekkus treatment |
| --- | --- | --- |
| Day 0 compliance stack | Docs/backlog | Covered by compliance/release gates; missing UGC, disclosure, scanning, and incident gaps are backlog items. |
| UGC compliance | Backlog | Report/block, moderation, dispute, takedown, fake-review, and incentive disclosure work added. |
| Place data/ranking | Docs/backlog | Ranking transparency, provider attribution, owner correction/claim workflows, and change logs remain owner-doc/backlog work. |
| Location/GPS privacy | Backlog | Contextual permission, manual fallback, and precise-location minimization added. |
| Food safety/allergen data | Deferred | Explicitly deferred until Rekkus displays health, inspection, allergen, or safety claims. |
| App-store compliance | Backlog/docs | UGC, privacy/data safety, age/alcohol, provider attribution, and support-link gates belong in release/store work. |
| Payments/PCI/AFSL | Deferred | Explicitly deferred until billing, payouts, or marketplace payments become active. |
| Privacy laws | Docs/backlog | Privacy rights are covered; NDB/OAIC runbook and DPIA checklist added. |
| HIPAA/COPPA | Ignored | Not healthcare; not targeting children under 13. Revisit only if product scope changes. |
| AI laws | Deferred/docs | AI-generated post content/feeds remain deprioritized; future user-visible AI requires disclosure and risk review. |
| Accessibility | Backlog | Moved to P1 release-readiness checklist. |
| Web UI libraries/Next.js specifics | Ignored | Not applicable to the current Expo mobile app; reuse existing components. |
| Legal docs | Docs/Roy actionables | Privacy, Terms, AUP/takedown/contact expectations are tracked through release and Roy-owned actions. |
| Auth/access/secrets/OWASP/SSDLC | Docs/backlog | Supabase/RLS/secrets covered; SAST, secret scanning, and rate/abuse review remain actionable. |
| Infrastructure/cloud/security monitoring | Docs/backlog | Provider restrictions and backup exist; monitoring/scanning improvements are backlog work; WAF/CDN deferred until public web origin exists. |
| Certifications | Deferred | SOC 2/ISO certification deferred until enterprise/commercial trigger; lightweight ISO evidence continues. |
| Risk, DPIA, vendor, incident, DR, data governance | Docs/backlog | Existing owner docs cover the base; NDB, DPIA, vendor/DPA review, retention and soft-delete work remain tracked. |
| AI/human responsibility matrix | Docs | AI may draft/detect; humans own legal sign-off, moderation escalations, incidents, store submissions, and regulatory notices. |
| Operational compliance | Docs/backlog | Vulnerability disclosure/security.txt and recurring evidence review are tracked; formal policy suite deferred. |
| System hygiene/tooling | Docs/ignored/backlog | Keep npm/Expo/GitHub Actions; ignore pnpm monorepo, Prisma, Next.js, raw web performance guidance; evaluate SBOM/license/dependency automation. |

## Audit Evidence

Audit automatically or through controlled service paths:

- canonical place edits
- source links and unlinks
- provider cache refreshes
- alias and merge decisions
- observation promotion and rejection
- moderation and admin actions
- account deletion and data export
- privacy request handling
- ownership claims/transfers
- data repair reports
- release approvals
- security incident actions
- provider kill-switch changes
- async job runs, failures, and retries
- dish audit (dish graph creation, merge, update via `dish_audit_events`)
- auth audit (login, logout, OAuth, password change via `auth_audit_events` — permanent retention, ISO A.12.4.1; context includes `provider`, `device_os`, `device_version` from client; `ip_hash` (SHA-256, pseudonymised) and `device_os` from server-side `auth-audit-hook` Edge Function on `auth.sessions` INSERT; raw IP is never stored; SHA-256 is GDPR-safe pseudonymisation under recital 26; B-520)
- content lifecycle (post/comment creation and deletion via `content_lifecycle_events` — no FK, survives cascade delete)
- user profile audit (username, avatar, bio, display name changes via `user_profile_audit_events` — context stores field names only, never values; ISO A.12.4 gap closure, B-517)
- collection audit (collection create, rename, delete, item add/remove, visibility change via `collection_audit_events` — no FK on collection_id so records survive collection deletion; B-518)
- feature flag audit (runtime override create/update/removal via `feature_flag_audit_events` — fail-closed database trigger prevents unaudited control changes; B-521)
- saved search audit (saved search create/update/delete via `saved_search_audit_events` — context omits raw query text; B-553)
- user top spots audit (top spot set/removed/reordered via `user_top_spots_audit_events` — user_id ON DELETE SET NULL, place_id no FK so records survive deletion; written via `record_top_spot_audit_event` SECURITY DEFINER RPC)

Audit records should include actor type, actor ID where available, action, entity type, entity ID, before/after summary, source/provider, reason, request/job ID, timestamp, compliance category, and rollback reference. Do not store secrets, raw private exports, unnecessary PII, or restricted provider payloads in audit logs.

All domain audit tables are unified under `platform_audit_events_view` (see ADR 0011). Query via service-role for cross-domain compliance evidence. The `check:audit` guardrail ensures every `*_audit_events` table is present in the view.

## ISO Readiness Map

| Area | Evidence |
| --- | --- |
| Asset inventory | Data Inventory and Provider Register above |
| Access control | RLS checks, SECURITY.md, migrations |
| Supplier management | Provider Register, COSTS.md, RELEASE.md |
| Secure development | API_GOVERNANCE.md, check:hygiene, check:providers |
| Incident response | SECURITY.md incident runbook, INCIDENTS.md |
| Logging | analytics_events, restaurant_audit_events (historical name retained), ops summaries |
| Post editing | `posts.last_edited_at`, `posts.edit_count`, `post_edit_events`; owner-only updates, minimized audit rows, and same-post-ID saves |
| Monitoring | OBSERVABILITY.md, check:ops, scheduled CI |
| Vulnerability management | check:deps, dependency governance |
| Backup | DISASTER_RECOVERY.md, check:dr |
| Recovery | RELEASE.md rollback and disaster recovery |
| Data classification | Data Inventory and SECURITY.md |
| Retention | Data Inventory and release/privacy gates |
| Privacy | Privacy Rights and Privacy/Data settings screen |
| Change management | BACKLOG.md, ADRs, PR review, CI checks |

## Release Gate

Before beta/production or risky feature release:

- `npm run check:compliance`
- `npm run check:data-inventory`
- `npm run check:rls`
- `npm run check:audit`
- `npm run check:providers`
- `npm run check:privacy`
- `npm run check:iso`
- `npm run check:release`

Release is blocked when privacy links, Terms, deletion/export, provider attribution, App Store privacy details, Google Play Data Safety, RLS, audit coverage, or provider terms review are stale.
Release is also blocked for public beta/production when UGC report/block/moderation, vulnerability disclosure, NDB/OAIC incident readiness, contextual location review, or required takedown/dispute contact paths are missing.
