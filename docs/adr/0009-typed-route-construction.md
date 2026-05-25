# ADR 0009: Typed Route Construction

Status: Accepted
Date: 2026-05-25
Owner: Engineering

## Context

Inline Expo Router path strings and parameter objects caused navigation regressions when routes or expected parameters changed.

## Decision

Construct dynamic app routes through typed helpers in `lib/routes/`. Keep the canonical pattern provisional until the intended app and feature surfaces are fully guarded against inline route construction.

## Consequences

- Route renames and parameter changes have one reviewable ownership boundary.
- Shared presentation components remain navigation-agnostic.

## Alternatives Considered

- Inline `router.push` values in consumers: rejected because they duplicate route contracts invisibly.

## Rollback Or Revisit Trigger

Promote to stable when enforcement covers all intended dynamic-route consumers; revisit if Expo Router provides stronger generated route typing.
