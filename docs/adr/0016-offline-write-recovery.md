# ADR 0016: Offline Write Recovery

Status: Accepted
Date: 2026-05-27
Owner: Product Engineering

## Context

Mobile connectivity can disappear after a user toggles state or begins publishing content. Silent loss is confusing, but replaying authored, destructive, safety, or account work later can send content or perform sensitive actions without current confirmation.

## Decision

- `ConnectivityProvider` is the single owner of network state and pending offline replay, scoped under authenticated identity.
- `<ConnectivityNotice>` is the canonical app-wide presentation for offline, syncing, synced, and failed pending-work states.
- Only reversible latest-state intents replay automatically: saves, follows, likes/reactions, saved-place status, inbox preferences, and settings.
- Persisted intents contain user ID, operation domain, entity identifiers, target state, timestamps, and retry bookkeeping only. They never contain authored text, media, profile/auth values, or report details.
- Pending intents coalesce by user, domain, and entity. Reconnect flushes only the active user's records; sign-out clears that user's records.
- Posts, edits, comments, messages, attachments, reports, blocks, claims/corrections, collection governance, group membership, profile/auth/account actions, and onboarding submissions stop offline and require explicit retry.

## Consequences

- `expo-network` and versioned `AsyncStorage` pending-intent storage become app runtime dependencies.
- Transport failures may remain queued with bounded retries and expiry; invalid or non-retryable records are discarded with privacy-safe operational signals.
- Feed and search content remains in memory while mounted, but this decision creates no general offline content cache.

## Rollback Or Revisit Trigger

Revisit if sensitive operation confirmation becomes durable and user-visible enough to support safe replay, or if queue failure rates show that bounded device-local recovery is inadequate.
