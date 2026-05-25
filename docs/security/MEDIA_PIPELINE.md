# Media Pipeline Governance

Owner: Engineering

Media pipeline governance protects upload quality, user safety, and storage cost before media volume grows.

## Scope

| Asset | Owner | Current Rule |
| --- | --- | --- |
| Avatars | Supabase Storage `avatars` bucket | Public-readable, user-scoped writes. |
| Draft post media | Supabase Storage `post-drafts` bucket | Private, user-scoped read/write/delete for explicitly saved or autosaved create drafts. |
| Post photos/videos | Hybrid post media pipeline | Validate type, size, path, ownership, and processing status before public launch. |
| Thumbnails and variants | `post_photos` media metadata + `process-post-media` | Define variants before generating multiple stored copies. |

## Upload Rules

- `lib/services/media.ts` owns current client-side post media picker validation for count, MIME type, extension, duration, and file size; server/storage validation must still exist before public upload launch.
- Validate MIME type and file extension before upload.
- For post photos, allow JPEG, PNG, WebP, HEIC, or HEIF. For post videos, allow MP4, MOV/QuickTime, or M4V and cap v1 creation at 3 videos, 10 total media items, and 60 seconds per video.
- Reject files whose declared MIME type, file extension, and decoded image metadata disagree.
- Enforce maximum file size before upload; default post-image limit is 8 MB at picker validation, post-video limit is 100 MB at picker validation, and stored display variants still need server-side normalization before public upload launch.
- Enforce image dimension sanity before upload; reject images below 320px on the shortest side or above 6000px on the longest side until the pipeline has server-side normalization.
- Use user-scoped temp paths for drafts and immutable published paths for user-owned media: private saved draft media uses `post-drafts/{user_id}/{draft_id}/{asset_id}.{ext}` and published media should use immutable post paths for committed originals or normalized display assets.
- Never store private media in public buckets.
- Keep service-role media repair or cleanup work in Edge Functions or controlled operations scripts.
- Record abandoned-upload cleanup and deleted-media behavior before production.

## Compression Rules

- Aggressive image compression is the default for public media once post-photo storage ships.
- Normalize post photos to WebP or JPEG for display unless source transparency requires PNG.
- Strip EXIF and location metadata before storing public post media.
- Target visually acceptable display quality before byte-perfect preservation; dense feeds should use compressed variants rather than originals.
- Preserve originals only when a rollback, moderation, or future reprocessing need is explicitly documented with retention and cleanup.
- Compression now starts on device through `lib/services/postMediaProcessing.ts` and `react-native-compressor`; oversized images are compressed to feed-safe dimensions and oversized videos are compressed with a bounded bitrate/size target before upload where possible.
- Server processing is additive and future-proofed through `supabase/functions/process-post-media`. The v1 function is an orchestrator/lightweight fallback that can later dispatch to a dedicated worker without changing app-facing post media types.
- `process-post-media` rejects malformed `mediaIds` request bodies with `400` before any service-role media access.

## Variants

| Variant | Intended surface | Target size | Retention | Notes |
| --- | --- | --- | --- | --- |
| `thumb` | Dense grids, profile thumbnails, saved lists | 320px longest edge | Same as parent post | Default list image; regenerate from normalized source if needed. |
| `feed` | Feed cards and post previews | 1080px longest edge | Same as parent post | Primary public display asset. |
| `full` | Detail inspection and moderation review | 1600px longest edge | Same as parent post unless originals are approved | Avoid loading in dense lists. |

- Do not add a new variant without naming owner, surface, dimensions, retention, and cleanup path.
- Generate thumbnails from the normalized source, not repeatedly from already compressed thumbnails.
- Store variant metadata with the post/photo record before relying on it for rendering or cleanup.
- Missing thumbnails should degrade to the `feed` variant and enqueue regeneration only after an explicit job policy exists.

## Post Media Metadata

`post_photos` remains the compatibility table name. New post media rows store `media_type`, `original_url`, `processed_url`, `thumbnail_url`, MIME, size, dimensions, duration, `processing_status`, and `processing_error`. Existing `url` remains the compatibility display URL.

Client state can show `local_ready`, `uploading`, `uploaded`, `processing`, `ready`, and `failed`. Failed processing must keep the draft recoverable and never silently publish unsafe media.

Thumbnail generation stays out of the client UI until a trusted normalization path exists. Generate thumbnails once from the normalized source and store variant metadata rather than repeatedly transforming display URLs.

## Draft Media

`post_drafts` stores create-state fields for autosave, saved, discarded, and published draft records. `post_draft_media` stores the ordered private media references, MIME, size, dimensions, duration, cover flag, and processing status needed for cross-device resume. Draft list queries only `status='saved'`; autosaves remain recovery-only.

Draft media access is owner-only through RLS plus `post-drafts` storage policies keyed by the first path segment. Deleting a draft marks the row `discarded`; storage cleanup remains a controlled follow-up job so no published media is touched accidentally.

## Provider Photo Policy

Google or other provider photos should not be copied into Rekkus storage/CDN unless terms, attribution, retention, and cacheability are explicitly approved. Until then, store durable provider IDs and first-party/user media, not provider image binaries.

## Lazy Image Loading

Dense surfaces should render thumbnails or placeholders first, use bounded image dimensions, and avoid loading full-size media until detail or moderation review. New image-heavy screens must explain which variant they load.

## Cost Rules

- Do not create new variants without an owner, retention rule, and cleanup path.
- Track storage growth as an observability signal before beta scale.
- Prefer thumbnails for dense lists and full-size media only where inspection matters.
- Keep CDN/storage lifecycle decisions in this doc or a linked ADR when they become durable.
- CDN caching strategy must favor immutable user-owned media paths and must not cache restricted provider media beyond permitted terms.
- Storage growth monitoring is owned by `operations/COSTS.md` and `npm run check:google-costs`.

## Storage Lifecycle

- Public post media may use public-readable storage only after upload validation, metadata stripping, and user ownership checks pass.
- CDN caching should favor immutable asset paths; replace media by writing a new asset ID rather than mutating an existing path.
- Deleted posts should hide media immediately in app data, then remove storage objects through a controlled cleanup job or script.
- Abandoned uploads without a committed post record should be eligible for cleanup after 24 hours.
- Deleted-media cleanup should be idempotent and log object path, actor/job, deleted-at timestamp, and failure reason without storing private content.
- Storage recovery expectations remain owned by [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md).

## Release Gates

- Before public beta: validate type/extension/dimensions/size, compression, metadata stripping, and user-scoped paths for post photos.
- Before production: enable or document media cleanup cadence, storage growth review, and a cost dashboard owner.
- Any change that increases stored variants, public media exposure, or retention must update [../../operations/COSTS.md](../../operations/COSTS.md) and this doc.

## Direct Message Attachments

- **Bucket**: `message-attachments` (private)
- **Path**: `{conversation_id}/{sender_id}/{timestamp}_{filename}`
- **RLS**: participants-only read; sender uploads to own prefix only
- **Accepted types and size limits**: images 10 MB (jpeg, png, webp), video 100 MB (mp4, quicktime), audio 25 MB (m4a, mp4), file 50 MB (any)
- **Upload flow**: client → quarantine path → `moderate-content` Edge Function CSAM check → final path (or deletion if flagged)
- **CSAM check**: SHA256 hash computed client-side via `expo-crypto` on first 64 KB; checked server-side against `csam_hash_blocklist` table in `moderate-content` Edge Function; match → file not stored, message not created, NCMEC CyberTipline report filed, user account suspended
- **Deletion**: attachment purged from storage within 24h of message deletion via cron job; deleted immediately on account delete
- **GIFs**: external URLs from GIPHY; no upload to Supabase Storage; no CSAM scan required because GIF provider content is pre-moderated
- **Stickers**: served from public `stickers` bucket; no user upload

## Guardrails

- `docs/security/SECURITY.md` owns the security checklist for uploads.
- `docs/security/DISASTER_RECOVERY.md` owns storage recovery expectations.
- `operations/COSTS.md` owns storage cost visibility.
- `npm run check:ops` validates media governance coverage.
