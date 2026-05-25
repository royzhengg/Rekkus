# ADR 0008: Remote Image Display

Status: Accepted
Date: 2026-05-25
Owner: Product/Engineering

## Context

Feed, messaging, and restaurant photos need caching and reduced-motion-aware transitions, while local editing media has different ownership and lifecycle needs.

## Decision

Use `<CachedImage>` for visible remote imagery. Keep explicit exceptions for local/editor media where the image is not a remote display surface.

## Consequences

- Remote images consistently use disk/memory caching and motion preferences.
- Accessibility and design checks can prevent new direct remote `Image` rendering.

## Alternatives Considered

- Direct React Native `Image` at each callsite: rejected because caching and transition behavior would diverge.

## Rollback Or Revisit Trigger

Revisit if the image provider changes or editor previews need the same remote-cache contract.
