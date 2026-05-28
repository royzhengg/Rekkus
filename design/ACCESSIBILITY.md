# Accessibility

Accessibility owns practical mobile checks for Rekkus before beta and release.

Candidate-specific physical-iPhone results belong in [../operations/IPHONE_HIG_ACCEPTANCE.md](../operations/IPHONE_HIG_ACCEPTANCE.md); beta and production promotion must pass `npm run check:hig-acceptance` for the exact build ID.

## Required Checks

| Area | Requirement |
| --- | --- |
| Screen reader | Primary actions, icon buttons, form inputs, tabs, and cards have useful accessible labels. |
| Touch targets | Interactive controls provide an effective minimum 44x44pt target. Use `hitSlop` to bridge visual size to 44pt without layout changes. |
| Contrast | Text, icons, and controls must remain readable in light and dark themes. |
| Text scaling | Layout-critical Text nodes (headers, chips, tabs, action bars) must set `maxFontSizeMultiplier={maxFontSizeMultiplier.layout}` (1.3×). Scrollable body copy uses `maxFontSizeMultiplier.body` (1.5×). Never use `allowFontScaling={false}`. `check:tokens` rejects raw font literals in `app/`, `features/`, `components/`, and `lib/contexts/`. |
| Error states | Forms and service failures need clear recovery copy. |
| Motion | Automatic motion and post autoplay use `useReducedMotion()`; manual drag, swipe, tap, and video play remain usable without animated settling. |
| Transparency | Experimental iOS material chrome must render an opaque fallback while Reduce Transparency is enabled; Android stays opaque. |
| System navigation | Every modal/overlay provides a visible iOS dismissal action and an Android `onRequestClose` handler; native stack back gestures must not be disabled without review. `check:risk-guardrails` enforces the source-level contract. |
| Interactive roles | Every interactive `TouchableOpacity` / `Pressable` with text children requires an explicit `accessibilityRole`. TalkBack (Android) relies on this more heavily than VoiceOver (iOS) — without it, Android reads elements as generic "View". `check:a11y` enforces this; pre-existing debt is tracked in `textRoleLegacyAllowlist` in `scripts/check-a11y.js` (B-532). |
| Tab semantics | Tab strips use `accessibilityRole="tablist"` on the container and `accessibilityRole="tab"` + `accessibilityState={{ selected }}` on each item. Decorative sliding indicators must be hidden with `importantForAccessibility="no"` and `accessibilityElementsHidden`. |
| Disabled state | `IconButton` propagates `accessibilityState={{ disabled }}` so screen readers announce unavailability without relying on color alone. |

Apple HIG applicability and linked follow-up work are tracked in [APPLE_HIG_REFERENCE.md](APPLE_HIG_REFERENCE.md). Root navigation now separates destination tabs from the floating Create action; both require screen-reader and large-text verification on iPhone and Android.

## Contrast Audit

`npm run check:a11y` enforces WCAG AA `4.5:1` contrast for normal token-backed text. Disabled text is excluded because disabled controls need a visibly inactive state.

| Theme | Token | Audited backgrounds | Lowest ratio |
| --- | --- | --- | --- |
| Light | `text` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `14.19:1` |
| Light | `text2` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `5.23:1` |
| Light | `text3` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `4.56:1` |
| Light | `chipDefaultText` | `chipDefaultBg` | `4.78:1` |
| Light | `chipActiveText` | `chipActiveBg` over `bg`, `surface`, `surface2` | `4.91:1` |
| Light | `ratingText` | `ratingBg` | `5.87:1` |
| Light | `errorText` | `errorBg` | `5.83:1` |
| Dark | `text` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `12.59:1` |
| Dark | `text2` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `6.02:1` |
| Dark | `text3` | `bg`, `surface`, `surface2`, `errorBg`, `ratingBg` | `4.72:1` |
| Dark | `chipDefaultText` | `chipDefaultBg` | `6.99:1` |
| Dark | `chipActiveText` | `chipActiveBg` over `bg`, `surface`, `surface2` | `6.40:1` |
| Dark | `ratingText` | `ratingBg` | `6.74:1` |
| Dark | `errorText` | `errorBg` | `5.58:1` |

## Permission Recovery (B-528)

When a user denies a permission, the app must offer an actionable recovery path — not just inform them.

**Canonical pattern:** Use `usePermissionRecovery` hook + `RekkusActionSheet` with "Open Settings" / "Not now" options. See `lib/hooks/usePermissionRecovery.ts` and [ADR 0013](../docs/adr/0013-permission-recovery-pattern.md).

**Android parity:** `canAskAgain: true` (first Android denial) — do not show the settings sheet; let the OS re-prompt. `canAskAgain: false` (permanent denial on Android or any denial on iOS) — surface the settings sheet.

**Form autofill:** All credential inputs (email, password, username) must carry `textContentType` (iOS) and `autoComplete` (Android) props so that password managers and the OS autofill framework can identify and fill them. Freeform inputs (search, hashtags, bio) must opt out with `textContentType="none"` `autoComplete="off"` to prevent incorrect suggestions.

## Reduced Motion And Media (B-529)

`useReducedMotion()` owns automatic entrances, modal transitions, map camera movement, looping typing state, and visible post video autoplay. Feed and post detail may autoplay the single visible active video only when the saved Appearance setting is enabled; autoplay is muted and always paused under Reduce Motion. Native video controls preserve user-initiated playback and audio control.

Verify on iOS Reduce Motion and Android reduced-animation settings: feed single-video playback, post-detail controls, sheets, map selection/recenter, messaging typing/actions, and create-media editing.

## Tab Material And Reduce Transparency (B-531)

The `iosTabBarMaterial` prototype is off by default and may render only in development or staging on iOS. It must switch to the token-backed opaque tab background when iOS Reduce Transparency is enabled, and Android, beta, and production must never render the blurred treatment.

Candidate promotion evidence must include the `Reduce Transparency` column in [../operations/IPHONE_HIG_ACCEPTANCE.md](../operations/IPHONE_HIG_ACCEPTANCE.md); a staging screenshot or simulator observation is not promotion evidence.

## Modal Navigation (B-536)

Source audit on 2026-05-27 found 16 React Native modal surfaces in `features/` and `components/`; each supplies `onRequestClose`. No native stack gesture override disables swipe-back. The only custom Android hardware-back interception is the create-post stepped flow shipped in B-534.

- `RestaurantPhotoGallery` keeps an explicit close/back affordance and handles Android back as `fullscreen -> grid -> close`.
- `RekkusActionSheet`, search/post/restaurant sheets, thumbnail peek, auth prompt, dish tagging, and messaging overlays all retain an explicit dismissal path plus Android system-back handling.
- `PanResponder` use is confined to dish-tag and media-strip editing interactions; it does not own route dismissal.

`scripts/lib/navigation-safety-rules.js` prevents new modals without `onRequestClose`, disabled native stack gestures, and unreviewed `BackHandler` interception. Simulator/device navigation smoke evidence remains required before B-536 can be closed.

## Priority Flows

- Auth and password reset.
- Search and Places.
- Restaurant detail and save actions.
- Create review.
- Settings, privacy, and account controls.

## Ownership

- Product behavior: [../product/UX.md](../product/UX.md)
- Release checks: [../operations/RELEASE.md](../operations/RELEASE.md)
- Component inventory: [UI_LIBRARY.md](UI_LIBRARY.md)
