# Lessons: Hook Declaration Order

## Declare `useMemo`/`useCallback` dependencies before the hook that uses them

```tsx
// ✓ correct
const validLocations = useMemo(() => ..., [savedLocations])
const zoom = useCallback(() => {
  const center = validLocations[0] // safe — declared above
}, [selectedLocation, validLocations])

// ✗ wrong — zoom callback references validLocations before its declaration
const zoom = useCallback(() => { ... }, [validLocations])
const validLocations = useMemo(...)
```

**Why:** JavaScript hoists `const` to temporal dead zone — referencing it before declaration throws at runtime. TypeScript may not catch this.
