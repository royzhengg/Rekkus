# ADR 0013: Canonical Permission Recovery Pattern

Status: Accepted
Date: 2026-05-27
Owner: Product Engineering

## Context

All permission denial sites previously used `Alert.alert('Permission required', 'Enable X in Settings.')`. This message gives users no actionable path: the alert dismisses and the user must manually navigate to the device Settings app. On iOS this violates App Store guidelines (apps must provide a recovery path for denied permissions). On Android the `canAskAgain` flag distinguishes between a re-requestable first denial and a permanent denial — the recovery UI must differ between these states.

Related ADRs: 0006 (routine and actionable failure surfaces), 0007 (in-app choice surfaces).

## Decision

Use `usePermissionRecovery` (`lib/hooks/usePermissionRecovery.ts`) for all inline component-level permission requests. The hook wraps any Expo permission request function and:

1. Returns the raw permission result to the caller — the caller decides what to do if granted.
2. If `!granted && !canAskAgain`: sets `recoveryVisible = true` and `recoveryMessage` to the caller-supplied string. The component renders a `<RekkusActionSheet>` with "Open Settings" (calls `Linking.openSettings()`) and "Not now" options.
3. If `!granted && canAskAgain` (Android first denial): returns without surfacing the sheet — the OS will re-prompt on next request.

For feature-level location state (SearchScreen / `useUserLocation`), the recovery is inline: when `status === 'denied'`, render a "Try again" link if `canAskAgain`, or an "Open Settings" link via `Linking.openSettings()` if not.

## Consequences

- All four permission denial sites (camera in StepMedia, camera + photo library + location in MessageInput, photo library in EditProfileScreen, location in SearchScreen) now offer an actionable recovery path.
- The `canAskAgain` invariant is enforced by the hook — Android first-denial is handled transparently without developer error.
- `check:risk-guardrails` (B-528 rule) fails if any new `Alert.alert` call references "Settings" in its message, preventing regression.
- `useUserLocation` exposes `canAskAgain` for feature-level consumers that manage location state directly.

## Rollback Or Revisit Trigger

Revisit if Expo changes the `PermissionResponse` shape or if a platform introduces a new permission timing model. The hook interface is narrow — wrapping a new permission type requires only calling `request(fn, message)`.
