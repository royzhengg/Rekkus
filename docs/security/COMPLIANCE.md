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
| user_settings | Product | User-private | User | Account lifetime | Included | Owner RLS |
| posts | Product | Public app data | User | Account lifetime unless deleted | Included where user-owned | Public select, owner mutation |
| post_photos | Product | Public media | User | Account lifetime unless deleted | Included as URLs/metadata | Public select, owner mutation |
| post_edit_events | Security | Audit evidence | System/user action | Compliance audit retention | Minimized audit rows; not normal public export | Owner insert/select via RLS |
| post_drafts | Product | User-private draft content | User/autosave | Account lifetime unless discarded/published cleanup | Included for owner; autosaves recovery-only | Owner RLS |
| post_draft_media | Product | User-private draft media metadata | User/autosave | Follows draft lifecycle; cleanup job pending | Included for owner | Owner RLS plus private storage policies |
| hashtags | Product | Public taxonomy | User/system | Retained while referenced | Not user-private | Public select, authenticated insert |
| post_hashtags | Product | Public post metadata | User | Follows post lifetime | Included through posts | Public select, owner mutation |
| restaurants | Product/Data | Canonical public restaurant data | Rekkus/user/provider/admin | Retained while restaurant exists | Not user-owned except submitted observations | Public select, controlled mutation |
| cuisine_aliases | Product/Data | Public taxonomy | Rekkus/system | Retained while search taxonomy exists | Not user-owned | Public select, migration/admin write |
| suburb_aliases | Product/Data | Public local discovery taxonomy | Rekkus/system | Retained while local search taxonomy exists | Not user-owned | Public select, migration/admin write |
| suburb_lookups | Product/Data | Public locality lookup metadata | Public/open locality data and admin seed | Retained while local search taxonomy exists | Not user-owned | Public select, migration/admin seed |
| restaurant_popularity_cache | Analytics/Data | Aggregate restaurant engagement signal | Derived from public posts and privacy-safe events | Refreshed aggregate cache | Aggregated/de-identified | Public select, service refresh |
| trending_searches | Analytics | Aggregate discovery signal | Derived from privacy-safe search events | Refreshed aggregate cache | Aggregated/de-identified | Public select, service refresh |
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
| analytics_events | Analytics | Internal telemetry | User behavior/system | Time-window review, aggregate later | De-identify or delete link when required | Insert own, aggregate/public read |
| saved_locations | Product | User-private saved restaurant intent | User | Account lifetime | Included | Owner RLS |
| collections | Product | User-private/shareable collection metadata | User | Account lifetime unless deleted | Included | Owner RLS; unlisted/public select |
| collection_items | Product | User-private/shareable collection membership | User | Account lifetime unless deleted | Included | Owner RLS via collection; unlisted/public select |
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
| Google Places | Fallback autocomplete/details/text search | Restricted provider_google | Place IDs durable; content only as allowed by current terms | Required when displaying Google-derived content | Field masks, session tokens, dedupe, cache, quota monitor | Disable fallback in provider gateway |
| Google Maps | Map rendering | Restricted maps provider | Do not treat tiles/map content as restaurant data | Required by SDK/platform | Key restrictions and quota review | Disable map-dependent surfaces or switch provider |
| OpenStreetMap | Future seed/evaluation | open_osm / ODbL | Requires attribution/share-alike planning | Required | ADR before import | Keep disabled until reviewed |
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
- Analytics metadata is sanitized in `lib/analytics.ts` before insertion and checked by privacy/compliance automation.
- Post edit audit data is minimized to changed field names/count. Do not store raw captions, media URLs, restaurant names, addresses, report notes, or before/after content in `post_edit_events`.

## Location Minimization

- Search and Places must not request GPS on mount; permission is requested only after a user taps a location-powered control.
- Manual suburb/postcode fallback is allowed for search ranking and provider biasing without requiring GPS permission.
- Precise coordinates are held in app memory for active ranking/map/post-visit flows and are not inserted into analytics metadata.
- Manual area labels may be shown in UI, but analytics should record only feature outcome/source fields, not exact coordinates or full addresses.
- Persistent precise location, background location, or location history needs a DPIA/PIA and release review before shipping.

## Retention Policy

| Data | Retention rule | Deletion/export |
| --- | --- | --- |
| Auth identities and profile data | Account lifetime unless deleted | Included in account deletion/export where user-owned |
| Posts, comments, reactions, follows, saves, saved locations | Account lifetime unless deleted or moderated | Included where user-owned |
| Public post media | Account lifetime unless post/media is deleted | URLs/metadata included; storage cleanup follows media lifecycle |
| Offline saved cache | Device-local best-effort cache, overwritten on refresh | Cleared by app/device data removal; server deletion remains source of truth |
| Analytics events | Time-window review for raw events, aggregate later where practical | Delete/de-identify user link when required; no precise location or secrets |
| Moderation reports, actions, appeals, trust state | Manual review/audit retention | User-linked records included where appropriate; audit records minimized |
| Privacy requests and security incidents | Legal/audit retention | Minimized and retained when justified |
| Provider cache | Provider terms and TTL/freshness policy | Governed by provider terms and source attribution |
| Messages (body + attachment) | Soft-deleted on user request; body and attachment_url nulled immediately for true erasure; storage file purged within 24h via cron job | Message row retained with deleted_at for audit and moderation continuity |

## CSAM / Media Safety

Rekkus checks all image and video attachments in direct messages against a CSAM hash blocklist before the message is stored. Detected content is blocked, quarantined, and reported to NCMEC via the CyberTipline API. Rekkus is a registered NCMEC Electronic Service Provider. Text messages are screened against a keyword blocklist for grooming/solicitation language. Violations are logged in `content_reports` with type `csam_detected`.

Message deletion provides true erasure: `messages.body`, `attachment_url`, and `attachment_metadata` are set to NULL at delete time, not merely flagged. Attachment files are removed from the `message-attachments` storage bucket by a background job within 24 hours. The message row itself is retained with `deleted_at` set for audit and moderation continuity. Account deletion cascades to all message participant records; body and attachment fields are nulled before the account row is removed.

## UGC, Reviews, And Ranking

- Report and block flows are release-critical for posts, comments, profiles, and other user-generated content.
- Moderation actions must be auditable, reversible where practical, and reviewable by a human for borderline or legally risky content.
- Review incentives, paid placement, or restaurant-owner influence must be disclosed before the content or ranking surface is shown to users.
- Restaurant and user disputes need an intake path, status trail, owner, and SLA; negative reviews must not be selectively removed for commercial reasons.
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
| Restaurant data/ranking | Docs/backlog | Ranking transparency, provider attribution, owner correction/claim workflows, and change logs remain owner-doc/backlog work. |
| Location/GPS privacy | Backlog | Contextual permission, manual fallback, and precise-location minimization added. |
| Food safety/allergen data | Deferred | Explicitly deferred until Rekkus displays health, inspection, allergen, or safety claims. |
| App-store compliance | Backlog/docs | UGC, privacy/data safety, age/alcohol, provider attribution, and support-link gates belong in release/store work. |
| Payments/PCI/AFSL | Deferred | Explicitly deferred until billing, payouts, or marketplace payments become active. |
| Privacy laws | Docs/backlog | Privacy rights are covered; NDB/OAIC runbook and DPIA checklist added. |
| HIPAA/COPPA | Ignored | Not healthcare; not targeting children under 13. Revisit only if product scope changes. |
| AI laws | Deferred/docs | AI-generated reviews/feeds remain deprioritized; future user-visible AI requires disclosure and risk review. |
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

- canonical restaurant edits
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

Audit records should include actor type, actor ID where available, action, entity type, entity ID, before/after summary, source/provider, reason, request/job ID, timestamp, compliance category, and rollback reference. Do not store secrets, raw private exports, unnecessary PII, or restricted provider payloads in audit logs.

## ISO Readiness Map

| Area | Evidence |
| --- | --- |
| Asset inventory | Data Inventory and Provider Register above |
| Access control | RLS checks, SECURITY.md, migrations |
| Supplier management | Provider Register, COSTS.md, RELEASE.md |
| Secure development | API_GOVERNANCE.md, check:hygiene, check:providers |
| Incident response | SECURITY.md incident runbook, INCIDENTS.md |
| Logging | analytics_events, restaurant_audit_events, ops summaries |
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
