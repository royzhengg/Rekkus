# ADR-0004: GIF provider — keep Giphy, add gifSearch kill-switch

Date: 2026-05-22
Status: Accepted
Deciders: Roy Zheng

## Context

ARCH-013 required verifying that Giphy is actually used and evaluating whether to switch to Tenor's free tier.

**Current state:**
- `lib/services/gifs.ts` calls `api.giphy.com/v1/gifs` for trending and search GIFs.
- `features/messages/MessageInput.tsx` renders a GIF picker button in the attachment tray.
- Three env vars (`EXPO_PUBLIC_GIPHY_IOS_API_KEY`, `EXPO_PUBLIC_GIPHY_ANDROID_API_KEY`, `EXPO_PUBLIC_GIPHY_API_KEY`) allow platform-specific keys with fallback.
- `hasGifProvider()` degrades gracefully: no API key → error string shown, no crash.
- The feature is gated by `directMessages` but not by its own flag — it cannot be killed without disabling all of DMs.

**Tenor evaluation:**
The backlog item noted Tenor as "free, no API key required for basic usage." This was accurate for Tenor API v1 (deprecated). Tenor API v2 (2022+) requires a Google Cloud API key (via the Custom Search / Tenor API product). There is no net advantage over Giphy: same key management overhead, a migration cost, and Google dependency on top of an already Google-heavy infrastructure (Maps, Places, geocoding).

## Decision

Keep Giphy. Add a `gifSearch` feature flag independent of `directMessages` so GIF capability can be disabled at runtime without a release and without affecting messaging itself.

## Consequences

- Annual Giphy key rotation is required (documented in `operations/COSTS.md`).
- Roy must verify dashboard restrictions are in place before beta (same cadence as Maps/Places keys).
- If Giphy changes pricing or terms, `gifSearch` can be flipped to `false` to degrade cleanly.
- Any future GIF provider swap (Tenor v3, DALL·E animated, etc.) is isolated to `lib/services/gifs.ts` + this flag — no screen code changes needed.
