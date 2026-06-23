# Media lessons

## Never present a native picker synchronously after dismissing a React Native Modal

**Bug (2026-06, updated fix 2026-06):** Tapping Camera or Media library in the create-post action sheet did nothing on a real device — non-deterministically. No error, no picker.

**Why it happens:** `RekkusActionSheet` wraps options in a React Native `Modal` with `animationType="slide"`. On iOS, the OS will silently drop any attempt to present a new native view controller (camera or photo library picker) while another modal VC is still in its ~350ms dismiss animation. Android can fail similarly when a Dialog/Activity transition is in flight.

The previous fix used `setTimeout(fn, 350)`. This is still racy: the iOS `Modal` animation is itself ~350ms, and the JS→native bridge adds 1–3 frames of latency before the animation even starts. So `setTimeout(350)` often fires 50–100ms before the animation completes.

**The correct fix:** use `RekkusActionSheet.onAfterDismiss`, which maps to the native `Modal.onDismiss` prop on iOS. This fires after the dismiss animation has fully completed — no race possible. Keep a `setTimeout` at 500ms as an Android fallback (Modal.onDismiss is iOS-only):

```typescript
const pendingPickerRef = useRef<'camera' | 'library' | null>(null)

function firePendingPicker() {
  const pending = pendingPickerRef.current
  pendingPickerRef.current = null
  if (pending === 'camera') void takePhoto()
  else if (pending === 'library') void addMedia()
}

<RekkusActionSheet
  onSelect={v => {
    pendingPickerRef.current = v === 'camera' ? 'camera' : 'library'
    setSheetVisible(false)
    setTimeout(firePendingPicker, 500)  // Android fallback
  }}
  onAfterDismiss={firePendingPicker}    // iOS: fires after animation ends
  onDismiss={() => setSheetVisible(false)}
/>
```

`firePendingPicker` clears the ref before acting so the iOS and Android paths are idempotent — whichever fires second is a no-op.

**Where to apply:** any `RekkusActionSheet.onSelect` that follows with native camera, photo library, document picker, or any other native VC/Activity. Do NOT use raw `setTimeout` — it will race on devices under load.

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

## Preserve post cover URL fallbacks across service and cache boundaries

**Bug (2026-06):** Saved posts could keep showing blank placeholders after post cover fallback logic was added. The service extractor filled missing `processed_url` with the raw media URL, so downstream code never got to prefer `thumbnail_url`; the saved-post hook also read an old first-page offline cache whose posts predated `imageUrl`.

**Fix:** Keep `processed_url` null when the provider row has no processed asset, then let the mapper choose `processed_url → thumbnail_url → raw url → legacy photo_url`. When a user-scoped persisted cache stores derived presentation fields, bump the cache key version when that shape changes.

**Regression tests:** `tests/unit/lib/services/posts.test.ts` verifies extraction preserves null `processed_url` so thumbnails can become covers. `tests/unit/lib/hooks/useSavedPosts.test.ts` verifies the saved-post first-page cache key is versioned.
