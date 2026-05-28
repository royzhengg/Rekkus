# ADR 0012: Destination Tabs And Floating Create

Status: Accepted
Date: 2026-05-26
Owner: Product Engineering

## Context

The root tab bar included a centre Create control that performed an action instead of navigating to a persistent top-level destination. Apple's tab-bar guidance identifies tabs as navigation, and the mixed behavior made the app's root structure less predictable across iPhone and Android.

## Decision

Keep visible bottom tabs for persistent destinations only: Feed, Search, Saved, and Profile. Expose creation as a floating, accessible action above the tab bar. The create route remains available for the composer, while create-launcher orchestration and auth gating remain outside the presentation-only floating button.

## Consequences

- Navigation state and action intent are visually distinct.
- Create remains available from primary browsing destinations on both supported mobile platforms.
- Floating-button placement and content clearance need accessibility and compact-layout verification.

## Rollback Or Revisit Trigger

Revisit if testing shows the floating action obstructs content or platform navigation conventions change; any replacement must keep creation clearly actionable and preserve cross-platform accessibility.
