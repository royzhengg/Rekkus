# Lessons: Design System

## Magic numbers in styles accumulate into inconsistency

When font sizes, spacing, and border radii are hardcoded per screen, they drift. After 10 screens the padding on a card is 16 in one place and 18 in another. Fix: import from `constants/Typography`, `constants/Spacing`, `constants/Colors` — one value, used everywhere.

---

## `ScreenHeader` replaces the repeated 56px topBar pattern

The `topBar` style block (height 56, paddingH 16, borderBottom) was copy-pasted into 9 screens. Now use `components/ui/ScreenHeader`:

```tsx
<ScreenHeader title="@username" left={<BackBtn />} right={<SettingsIcon />} />
```

---

## `ThumbGrid` replaces duplicated 3-col photo grids

The thumbnail grid was copy-pasted between `profile.tsx` and `user/[username].tsx`. It now lives in `components/ThumbGrid.tsx` and is imported by both.

---

## Shadow styles are design tokens too

Raw `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, and `elevation` values drift just like spacing and radius values. Use `constants/Elevation.ts` presets so cards, sheets, labels, and floating controls share the same depth language.

Prevention: `check:design` blocks raw shadow/elevation styles in `features/` and `components/`.

**Apply when:** adding any raised surface or floating control.

---

## Contrast tokens need executable audits

Secondary and tertiary text tokens can look acceptable in one theme while failing WCAG AA on adjacent surfaces. Fix token contrast at the source, then enforce it with `check:a11y` so future palette changes recalculate ratios instead of relying on a one-time manual review.

**Apply when:** changing text, surface, chip, rating, or error colour tokens.

---

## Routine failures need one owned surface

Inline text errors, failure alerts, and dismiss-only failure sheets drift in copy, placement, accessibility, and styling. `ErrorMessage` now owns routine load and mutation failure feedback; `RekkusActionSheet` remains appropriate when a failed workflow gives the user a real recovery action such as retry or review.

Prevention: `check:design` rejects custom error boxes, routine failure alerts, and dismiss-only failure notices, with scanner fixtures covering allowed validation, permission, success, and recovery flows.

---

## Canonical patterns require recorded decisions

A canonical table without rationale still invites a future agent to add a plausible competing pattern. Every active Canonical Patterns row in `AGENTS.md` must link to an accepted ADR, and `check:docs` rejects missing or non-accepted decisions.

Loading is intentionally contextual: use a spinner for compact action or pagination waits, skeletons for predictable content surfaces, and `<EmptyState loading>` only when a blocking full-screen transition has no meaningful content shape.

Prevention: `check:docs` validates active ADR linkage; `check:design` rejects bare centred content spinners while permitting the three documented loading cases.

---

## Manual accessibility evidence must be candidate-scoped

A one-time iPhone accessibility review becomes stale as soon as navigation, typography, motion, permissions, or shared controls change. Record VoiceOver, Dynamic Type, Reduce Motion, dark mode, permission-recovery, and touch-target results against the exact beta or production build tested on a physical iPhone.

Prevention: `check:hig-acceptance` validates the append-only evidence matrix during CI and blocks promotion unless `REKKUS_RELEASE_CANDIDATE` matches a passing physical-device record.

---

## Automatic motion and media need one accessibility owner

Autoplay, spring settles, modal transitions, camera moves, and looping indicators become inconsistent when each surface decides independently how Reduce Motion applies. Use `useReducedMotion()` for automatic motion, and keep post autoplay inside `usePostVideoPlayback()` with explicit visible-active eligibility from public surfaces.

Prevention: `check:risk-guardrails` rejects new unguarded motion/modal transitions, direct `Animated` use, generic or bypassed haptics, and post playback outside the canonical hook.

---

## Optional metadata should not displace primary contribution inputs

On food contribution screens, keep high-value dish signals and the written review visible before auxiliary classification fields. Collapse optional cuisine/tag metadata when empty, reopen it automatically for existing values, and surface a collapsed summary so compact layouts do not hide saved input.

**Apply when:** a composer grows long enough that optional enrichment pushes the core submission content below the initial viewport.

---

## Destination tabs must not disguise actions

A tab bar communicates persistent navigation destinations. Contribution is a primary action, so expose it separately with an accessible floating control while its auth and route behavior stays in the owning layout/provider.

**Apply when:** adding or reorganising root navigation actions.

---

## Translucent materials require an opaque accessibility path

Blurred or translucent navigation chrome can fail users who enable iOS Reduce Transparency and can create accidental Android-only degradation if copied broadly. Limit experimental material to a gated iOS presentation layer, keep Android opaque, and fall back immediately when Reduce Transparency is enabled.

Prevention: `check:risk-guardrails` blocks unstable native/glass adoption and missing gates/fallbacks; `check:hig-acceptance` requires Reduce Transparency evidence for candidate promotion.

---

## Dynamic Type and OS text scaling must be capped at layout boundaries

React Native `Text` scales with iOS Dynamic Type and Android Font Size settings by default with no upper bound. At the largest accessibility sizes (iOS up to 3.1×, Android up to 2×), fixed-height containers (headers, chips, tabs, action bars, wordmarks) overflow and primary actions become hidden or clipped.

Fix: import `maxFontSizeMultiplier` from `constants/Typography` and apply it to every layout-critical `Text` node.

```tsx
import { maxFontSizeMultiplier } from '@/constants/Typography'

// fixed-height container — header, chip, tab label, wordmark
<Text maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>…</Text>

// scrollable body copy that can wrap freely
<Text maxFontSizeMultiplier={maxFontSizeMultiplier.body}>…</Text>
```

Never use `allowFontScaling={false}` — this silently disables all Dynamic Type support.

Prevention: `check:tokens` rejects raw `fontSize` / `fontWeight` / `lineHeight` literals in `app/`, `features/`, `components/`, and `lib/contexts/`. The token constants in `constants/Typography.ts` are the only allowed source for numeric font values.

Android parity: `maxFontSizeMultiplier` works identically on Android. `KeyboardAvoidingView` must use `behavior="height"` on Android (not `undefined`) so inputs are not covered by the software keyboard.

---

## Interactive text elements need explicit `accessibilityRole` for Android parity

VoiceOver (iOS) infers button semantics from `onPress` alone. TalkBack (Android) does not — without `accessibilityRole`, it announces the element as a generic "View". Every `TouchableOpacity` or `Pressable` that wraps text content requires an explicit prop.

```tsx
// ✗ TalkBack reads as "View" on Android
<TouchableOpacity onPress={...}>
  <Text>Find dishes in Discover</Text>
</TouchableOpacity>

// ✓ Both VoiceOver and TalkBack announce correctly
<TouchableOpacity onPress={...} accessibilityRole="button">
  <Text>Find dishes in Discover</Text>
</TouchableOpacity>
```

Tab strips additionally need `accessibilityRole="tablist"` on the container and `accessibilityRole="tab"` + `accessibilityState={{ selected }}` on each item. Decorative sliding indicators must be hidden with `importantForAccessibility="no"` and `accessibilityElementsHidden`.

Use `hitSlop` to bridge small visual tap areas to 44pt without changing layout:

```tsx
hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }}
```

`IconButton` propagates `accessibilityState={{ disabled: !!disabled }}` — use it instead of a raw `TouchableOpacity` for all icon actions.

Prevention: `check:a11y` runs `reportTextOnlyButtonsMissingRole` on every `.tsx` file in `features/` and `components/`, failing CI if an interactive text element lacks `accessibilityRole`. Pre-existing debt was tracked per-file in `textRoleLegacyAllowlist`; B-534b cleared all entries — the allowlist is now empty and must stay empty.

**Apply when:** adding any `Text` node to a fixed-height container, or writing a `KeyboardAvoidingView` that wraps text inputs.

---

## Overlays must preserve system escape paths

Custom sheets and full-screen overlays sit above Expo Router navigation, so platform back behavior must be owned explicitly. Give iOS users a visible dismiss or back control, set `onRequestClose` on every React Native `Modal` for Android system back, and do not disable native stack gestures or add `BackHandler` interception without a reviewed backlog reason.

Prevention: `check:risk-guardrails` runs `navigationSafetyFailures` across app, feature, and shared component runtime code; B-534 is the intentional create-post Android back exception.

**Apply when:** adding or changing a modal, overlay, full-screen media experience, route gesture configuration, or custom hardware-back behavior.

---

## Success/info feedback belongs in Toast, not Alert.alert (B-402)

`Alert.alert` is a modal interrupt — it blocks the UI and demands user acknowledgement. Using it for success or info messages (e.g., "Password updated", "Conversation muted") breaks the user's flow for no reason.

**The canonical split:**

- `showToast()` (`lib/contexts/ToastContext`) — success or info confirmations; 3 s auto-dismiss; bottom overlay; `accessibilityLiveRegion="polite"` for screen-reader announcement
- `<ErrorMessage>` — inline routine errors that need persistent visibility
- `Alert.alert` — destructive confirmations only (must always have a cancel/destructive-style button)

**Root cause of the original gap:** no lightweight non-modal confirmation pattern existed, so developers reached for `Alert.alert` as the only available option.

**Guardrail:** `check:hygiene` (`scripts/check-hygiene.js`) detects `Alert.alert` calls in `features/` and `components/` that have no `style: 'cancel'` or `style: 'destructive'` button, and fails CI. Allowlist is reserved for validation-error alerts pending migration to `<ErrorMessage>`.

**accessibilityRole note:** React Native's `AccessibilityRole` type does not include `"status"`. Use `accessibilityLiveRegion="polite"` instead — this is the correct RN equivalent and is what `Toast.tsx` uses.

**Apply when:** any action that completes successfully needs to confirm it to the user (save, follow, copy, mute, report, email change, password change, etc.).


---

## Use aspectRatio to cap empty-state height, not fixed height (B-404)

Empty-state containers sized with a fixed `height` break on tablets and large phones; they also resist the layout engine's ability to compress on smaller screens. Using `aspectRatio` lets the container scale with its constrained width (e.g. screen width minus horizontal margins) while still providing a predictable visual footprint.

`photoEmpty` in `StepMedia.styles.ts` uses `aspectRatio: 2.2` with `marginHorizontal: spacing[4]` (16px each side). On a 375px screen this yields ~156px tall — enough to show the icon, label, sub-text, and action buttons without dominating the viewport. The previous value of 1.42 produced ~241px, delaying the restaurant search and dish tagging fields below the fold.

**Apply when:** designing any empty-state container that must fit gracefully across phone sizes — prefer `aspectRatio` over a hardcoded pixel height.
