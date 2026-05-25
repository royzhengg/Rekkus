# Async Safety in Hooks

## Debounced async effects: `clearTimeout` is not enough

`clearTimeout` cancels the *timer*, not the async work inside it. Once a debounced callback fires, all `await` points run to completion regardless of whether the component has unmounted or a newer query has superseded the request.

### Root cause (B-505/B-512)

`useSearch.ts` initially used only `clearTimeout`. A first guard then claimed ownership only after the replacement debounce fired, leaving an in-flight request able to publish after the query changed, cleared, or the component unmounted. `useAutocomplete.ts` and the extracted restaurant-search hook had the same bug class.

### Fix: ref-based request ID guard

```typescript
const requestIdRef = useRef(0)

useEffect(() => {
  const requestId = ++requestIdRef.current // invalidate previous work immediately
  if (!query) {
    setState([])
    return
  }

  const timer = setTimeout(async () => {
    // ... all async work ...

    if (requestId !== requestIdRef.current) return // stale: query changed or unmounted
    setState(results)

    // For any additional await after the first guard:
    const rows = await fetchMore(ids)
    if (requestId !== requestIdRef.current) return
    setOtherState(rows)
  }, 300)
  return () => {
    clearTimeout(timer)
    if (requestIdRef.current === requestId) requestIdRef.current += 1
  }
}, [query])
```

### Rules

- Claim a generation when the effect or async action begins, before debounce scheduling or any empty-query early return.
- Invalidate that generation on explicit clear and cleanup/unmount; do not wait for a replacement timer to fire.
- Add a guard before **every `setState` batch** that follows an `await`.
- Treat `setTimeout(() => { void (async () => { ... })() })` as the same debounced-async ownership pattern.
- Synchronous `setState` calls in `else` branches after a guard are safe — no new `await` between the guard and the setter.
- Intentional background work must handle/report failures and must not publish component state.

### Guardrail

`scripts/lib/async-safety-rules.js` enforces immediate invalidation and cleanup for the protected debounce hooks, including the promise-IIFE restaurant-search shape. `tests/type-safety/asyncSafetyRules.test.js` proves the stale-window forms fail, and behavioural hook tests prove stale/cleared/unmounted responses do not publish.

## Fatal promise and dependency lint

`no-floating-promises`, `no-misused-promises`, and `react-hooks/exhaustive-deps` are fatal gates after B-499.

- Await user-visible state changes and writes.
- Use `void promise.catch(captureCrash)` only for intentional background work without a user recovery path.
- Fix dependency ownership with callbacks or effect-local logic; do not suppress the rule.
