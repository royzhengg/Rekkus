# Lessons: Performance

## Wrap list-item components in `React.memo`

Any component rendered inside a list (map, FlatList, etc.) should be memoized.

```tsx
const PostCard = React.memo(function PostCard({ post, colWidth }) { ... })
```

**Why:** Without memo, a parent state change (e.g. tab switch, theme toggle) re-renders every card even if nothing about the card changed.

---

## Use `useCallback` for handlers passed to memoized children

`React.memo` is useless if the props passed to the child are new references every render.

```tsx
const navigateTo = useCallback((loc) => { ... }, [router])
// pass as: onPress={navigateTo}
```

**Why:** An inline `onPress={() => navigateTo(loc)}` creates a new function every render, defeating the memo.

---

## Use `react-native-reanimated` for all animations — never `Animated` from react-native

Reanimated runs on the UI thread; `Animated` runs on the JS thread.

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
const slideY = useSharedValue(300)
slideY.value = withSpring(0, { damping: 20, stiffness: 180 })
const style = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }))
```

**Why:** JS-thread animations stutter during any JS work (navigation, data fetching). UI-thread animations are guaranteed 60fps.

---

## Wrap icon components in `React.memo`

Standalone icon functions that call `useThemeColors()` should be memoized at the module level.

```tsx
const BellIcon = React.memo(function BellIcon() {
  const colors = useThemeColors()
  return <Svg ...>
})
```

**Why:** Icon components defined as plain functions recreate on every render of the parent. In a tab bar or list header this fires constantly.

---

## `useMemo` for computed/derived values used in render

Any value computed from state that's used in JSX or passed to a child should be memoized.

```tsx
const validLocations = useMemo(
  () => savedLocations.filter(l => l.restaurants?.latitude != null),
  [savedLocations]
)
```

---

## Performance regressions need executable budgets

Use hard failures for objective regressions like feature files over 600 LOC. Use advisory warnings for heuristic findings like likely non-reactive constant-data memoization.

**Why:** Hard budgets stop slow structural drift, while warnings surface cleanup opportunities without blocking on false positives.
