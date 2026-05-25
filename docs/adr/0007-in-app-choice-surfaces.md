# ADR 0007: In-App Choice Surfaces

Status: Accepted
Date: 2026-05-25
Owner: Product/Engineering

## Context

Choice lists, confirmations, and post actions need the same interaction, theming, safe-area, and Android behavior across platforms.

## Decision

Use `<RekkusActionSheet>` for in-app choice and action lists. Keep native system UI for permission prompts and dedicated full-screen UI for workflows that are not short action lists.

## Consequences

- Choice interactions share one cross-platform component and accessibility behavior.
- Platform-specific action-sheet APIs remain blocked unless a documented exception is required.

## Alternatives Considered

- `ActionSheetIOS` or ad hoc `Modal` instances: rejected because they fragment Android behavior and visual rules.

## Rollback Or Revisit Trigger

Revisit if platform UX requirements mandate a system-native list with a supported equivalent on all target platforms.
