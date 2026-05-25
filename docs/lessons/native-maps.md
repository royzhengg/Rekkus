# Lessons: Native / Maps

## Google Maps on iOS requires THREE things — all must be present

1. `iosGoogleMapsApiKey` (not `googleMapsApiKey`) in the react-native-maps plugin config in `app.json`
2. `pod 'react-native-maps/Google'` in `ios/Podfile`
3. `GMSServices.provideAPIKey(...)` called in `AppDelegate.swift` before any other setup

Missing any one of these causes a blank/white/black map with no error message.

---

## Always keep `MapView` mounted — never conditionally render it

Use `opacity: 0` + `pointerEvents: 'none'` to hide it, not conditional rendering or `display: 'none'`.

```tsx
<View style={[StyleSheet.absoluteFill, isHidden && { opacity: 0 }]} pointerEvents={isHidden ? 'none' : 'auto'}>
  <MapView ... />
</View>
```

**Why:** `MapView` needs to initialise with real dimensions. Conditional rendering gives it zero size on first mount → blank tiles. `display: 'none'` removes it from the native hierarchy → same problem.

---

## Add `tracksViewChanges={false}` to all `<Marker>` components

```tsx
<Marker coordinate={...} tracksViewChanges={false} onPress={...} />
```

**Why:** The default (`true`) causes every marker to re-render on every frame, tanking FPS on maps with many pins.
