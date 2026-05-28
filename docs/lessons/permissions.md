# Permissions

## Alert-only recovery is a bug class

**Root cause (B-528):** All permission denial sites used `Alert.alert('Permission required', 'Enable X in Settings.')`. The alert dismissed and the user had no way to act without manually navigating to Settings. Zero `Linking.openSettings()` calls existed in the codebase.

**Fix:** Use `usePermissionRecovery` (`lib/hooks/usePermissionRecovery.ts`) + `RekkusActionSheet` with an "Open Settings" option. See ADR 0013.

## The `canAskAgain` invariant (Android parity)

On Android, after the first denial `canAskAgain` is `true` — the system dialog will re-appear on the next request. Do NOT show "Open Settings" at this point. Only when `canAskAgain: false` (permanent denial) must the user go to device Settings. The `usePermissionRecovery` hook enforces this automatically.

On iOS, after the first denial `canAskAgain` is always `false` — the user must go to Settings.

`Linking.openSettings()` from React Native works on both iOS and Android (opens the app-level Settings page).

## Pattern for inline component-level requests

```ts
const { request, recoveryVisible, recoveryMessage, dismissRecovery, openSettings } = usePermissionRecovery()

// In handler:
const result = await request(
  () => ImagePicker.requestCameraPermissionsAsync(),
  'Camera access is needed. Enable it in Settings.'
)
if (!result.granted) return
// ... proceed

// In JSX:
<RekkusActionSheet
  visible={recoveryVisible}
  title="Permission required"
  subtitle={recoveryMessage}
  options={[
    { label: 'Open Settings', value: 'settings', accentColor: colors.accent },
    { label: 'Not now', value: 'cancel' },
  ]}
  onSelect={v => v === 'settings' ? openSettings() : dismissRecovery()}
  onDismiss={dismissRecovery}
/>
```

## Pattern for feature-level location state (SearchScreen)

`useUserLocation` exposes `canAskAgain` (added in B-528). When `status === 'denied'`:
- `canAskAgain: true` → show "Try again" button calling `requestLocation()`
- `canAskAgain: false` → show "Open Settings" link calling `Linking.openSettings()`

## CI guardrail

`check:risk-guardrails` (B-528 rule) fails if any `Alert.alert` call references "Settings" in its message, ensuring new sites follow the canonical pattern.
