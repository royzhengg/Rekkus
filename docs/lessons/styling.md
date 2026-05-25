# Lessons: Styling

## Always use `useMemo(() => makeStyles(c), [c])` — never module-level StyleSheet with colours

```tsx
const colors = useThemeColors()
const styles = useMemo(() => makeStyles(colors), [colors])
```

**Why:** Module-level `StyleSheet.create` with colour tokens runs once at import time and never updates. Theme changes and dark mode won't apply.
