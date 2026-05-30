# ADR 0017: Success and Info Confirmation Patterns

Status: Accepted
Date: 2026-05-30
Owner: Product Engineering

## Context

No lightweight non-modal confirmation pattern existed in the Rekkus app. Saves, follows, copies, mutes, and password changes produced no visible feedback — users had no confirmation whether the action succeeded. Developers reached for `Alert.alert` as the only available option, which is a modal interrupt that demands acknowledgement and breaks the user's flow.

`ErrorMessage` is errors-only (persistent, inline). `Alert.alert` is for destructive confirmations. A third pattern was missing: success and info notifications that auto-dismiss without interruption.

## Decision

- `<Toast>` (`components/ui/Toast.tsx`) is the canonical surface for success and info confirmations: auto-dismiss (default 3 s), bottom overlay, `accessibilityLiveRegion="polite"` for screen-reader announcement.
- `useToast()` (`lib/contexts/ToastContext`) provides the imperative `showToast(message, opts?)` API.
- `<ToastProvider>` is mounted once at app root (inside `<SettingsProvider>` in `app/_layout.tsx`); no per-screen Toast variants.
- `Alert.alert` is permitted only for confirmations that always include a cancel/destructive-style button (sign-out, delete, leave group, block). `check:hygiene` enforces this.
- `<ErrorMessage>` remains the canonical pattern for persistent inline errors.

## Consequences

- Saves, follows, copies, mutes, password updates, email changes, report acknowledgements, and similar success moments now surface a 3 s non-blocking feedback overlay.
- `check:hygiene` rejects new dismiss-only `Alert.alert` calls in `features/` and `components/`, with a small allowlist for legacy validation-error alerts (tracked in B-403).
- The `successBg`, `successText`, `infoBg`, and `infoText` tokens are added to `constants/Colors.ts` following the `errorBg`/`errorText` pattern.

## Alternatives Considered

- **`sonner-native` (npm package):** Listed in `design/UI_LIBRARY.md` as Medium Priority. Rejected for this implementation because the Rekkus design token system, `useReducedMotion()` guard, and `react-native-reanimated` animation stack are already fully established; a thin internal component avoids the maintenance and bundle cost of an external dependency.
- **`Alert.alert` for success:** Existing pattern. Rejected — modal interrupt for non-destructive feedback is disruptive and contradicts HIG/Material guidelines for transient confirmations.

## Rollback Or Revisit Trigger

Revisit if `sonner-native` or a similar library reaches stable release with full Reanimated 3 and reduced-motion support, and the bundle/maintenance cost becomes clearly worth the API ergonomics.
