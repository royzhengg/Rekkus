# Media lessons

## Never present a native picker synchronously after dismissing a React Native Modal

**Bug (2026-06):** Tapping Camera or Photo library in the create-post action sheet did nothing on a real device. No error, no picker.

**Why it happens:** `RekkusActionSheet` wraps options in a React Native `Modal` with `animationType="slide"`. On iOS, the OS will silently drop any attempt to present a new native view controller (camera or photo library picker) while another modal VC is still in its ~300ms dismiss animation. Android can fail similarly when a Dialog/Activity transition is in flight.

**The pattern that breaks:**
```typescript
onSelect={v => {
  setSheetVisible(false)            // starts dismiss animation
  void launchSomePicker()           // called while animation is still running — dropped on iOS
}}
```

**The fix:** defer the picker call past the animation with `setTimeout(fn, 350)`:
```typescript
onSelect={v => {
  setSheetVisible(false)
  setTimeout(() => void launchSomePicker(), 350)
}}
```

**Where to apply:** any `RekkusActionSheet.onSelect` (or any `Modal` `onRequestClose`/`onDismiss`) that immediately presents native camera, photo library, document picker, or any other native VC/Activity. The delay of 350ms covers the 300ms slide animation with a small margin.

**Regression test:** `tests/unit/features/StepMedia.test.tsx` — "StepMedia picker deferral" — verifies the picker is not called synchronously using jest fake timers.

## Treat OS permission prompts as native presentation windows too

**Bug (2026-06):** Photo library could still look like a no-op the first time a user selected it from the create-post sheet, even after deferring past the sheet dismissal.

**Why it happens:** The permission prompt is itself native UI. If the user grants access, launching `ImagePicker.launchImageLibraryAsync()` immediately after `requestMediaLibraryPermissionsAsync()` resolves can race the prompt dismissal just like launching immediately after a React Native modal dismissal.

**Fix:** Check existing permission first. If access is already granted, launch normally after the sheet deferral. If the app had to request permission, wait another 350ms after the permission promise resolves before launching camera/library.

**Regression test:** `tests/unit/features/StepMedia.test.tsx` — verifies first-time library permission waits through the permission-prompt presentation window before calling `launchImageLibraryAsync`.

## Do not request media permissions for passive previews

**Bug (2026-06):** The create-post recent-photo strip could touch photo permissions before the user chose Photo library, while the explicit picker path still had no visible failure state for native presentation errors. On device this can make Photo library look like a no-op.

**Fix:** Passive previews may only inspect existing permission with `MediaLibrary.getPermissionsAsync(false)`. They must not call `requestPermissionsAsync` or shared permission recovery. Explicit Camera/Photo library actions own permission prompts, native picker launch, recovery, and inline failure copy.

**Regression tests:** `tests/unit/lib/hooks/useRecentPhotos.test.ts` verifies recents never request permission on mount. `tests/unit/features/StepMedia.test.tsx` verifies denied permission delegates to recovery and picker rejection shows inline error copy.

## Resolve recent-photo asset info before validation

**Bug (2026-06):** Tapping a recent-photo thumbnail in create post could show "Could not add this photo. Check the file type and size" even for a normal simulator image.

**Why it happens:** iOS media-library assets can surface as `ph://` URIs or filenames without an image extension. The recent-photo shortcut bypasses `ImagePicker`, so validation cannot rely on picker-provided file URIs or MIME metadata.

**Fix:** On explicit recent-photo tap, call `MediaLibrary.getAssetInfoAsync(asset.id)` and validate `localUri ?? uri` with MIME inferred from filename/local URI/asset URI. Keep the recents strip passive on mount: no permission prompts.

**Regression tests:** `tests/unit/features/StepMedia.test.tsx` verifies extensionless `ph://` recent-photo assets resolve to local file URIs before media preparation and that unreadable metadata shows a recovery-oriented "Try Add media" error.
