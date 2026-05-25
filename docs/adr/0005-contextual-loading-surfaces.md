# ADR 0005: Contextual Loading Surfaces

Status: Accepted
Date: 2026-05-25
Owner: Product/Engineering

## Context

One loading treatment cannot describe action waits, predictable content fetches, and shape-less blocking transitions without either layout instability or misleading feedback.

## Decision

Use `ActivityIndicator` for action and pagination waits, `Skeleton` / `SkeletonText` for predictable content-shaped loading, and `<EmptyState loading>` only for blocking full-screen waits with no meaningful final silhouette.

## Consequences

- Loading feedback remains consistent with the amount of layout the app already knows.
- New centered content spinners are rejected by design checks.

## Alternatives Considered

- One full-screen spinner everywhere: rejected because it hides expected layout and causes avoidable visual churn.

## Rollback Or Revisit Trigger

Revisit if a single accessible loading primitive can preserve content shape and compact-action behavior without variants.
