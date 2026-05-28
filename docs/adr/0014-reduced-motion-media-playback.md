# ADR 0014: Reduced Motion And Post Video Playback

Status: Accepted
Date: 2026-05-27
Owner: Product Engineering

## Context

Automatic animation and media playback appeared across feed, sheets, maps, messaging, and media editing without one accessibility ownership boundary. Post videos also needed controls and a user preference without allowing several mounted cards to play at once.

## Decision

- All automatic entrances, settling effects, modal transitions, programmatic map camera motion, looping indicators, and autoplay consult `useReducedMotion()`.
- Direct manipulation remains available. Dragging, swiping, tapping, and manual video playback are never disabled by Reduce Motion.
- `usePostVideoPlayback()` is the only owner of post video autoplay. It plays muted video only when `autoplay_videos` is enabled, the current slide/card is the active visible public surface, and Reduce Motion is off. Otherwise it pauses.
- Public feed and post detail may opt into autoplay. Create/review previews and messaging attachments remain user-operated.
- Semantic haptics are limited to like/save confirmations and successful publication.

## Consequences

- `user_settings.autoplay_videos` stores the user preference, defaulting to `true`; the operating-system Reduce Motion setting has precedence.
- `PostMediaCarousel` exposes native playback controls and accepts explicit playback eligibility rather than inferring visibility.
- `scripts/lib/motion-rules.js`, enforced from `check:risk-guardrails`, rejects direct animation/playback/haptic ownership bypasses and unguarded native modal transitions.

## Rollback Or Revisit Trigger

Revisit if platform media lifecycle APIs provide a stronger single-visible-player primitive or if user research supports autoplay being off by default. The persisted boolean can be migrated without altering the reduced-motion override.
