# Async Safety in Hooks

## Debounced async effects: `clearTimeout` is not enough

`clearTimeout` cancels the *timer*, not the async work inside it. Once a debounced callback fires, all `await` points run to completion regardless of whether the component has unmounted or a newer query has superseded the request.

### Root cause (B-505/B-512)

`useSearch.ts` initially used only `clearTimeout`. A first guard then claimed ownership only after the replacement debounce fired, leaving an in-flight request able to publish after the query changed, cleared, or the component unmounted. `useAutocomplete.ts` and the extracted place-search hook had the same bug class.

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

`scripts/lib/async-safety-rules.js` enforces immediate invalidation and cleanup for the protected debounce hooks, including the promise-IIFE place-search shape. `tests/type-safety/asyncSafetyRules.test.js` proves the stale-window forms fail, and behavioural hook tests prove stale/cleared/unmounted responses do not publish.

## Fatal promise and dependency lint

`no-floating-promises`, `no-misused-promises`, and `react-hooks/exhaustive-deps` are fatal gates after B-499.

- Await user-visible state changes and writes.
- Use `void promise.catch(captureCrash)` only for intentional background work without a user recovery path.
- Fix dependency ownership with callbacks or effect-local logic; do not suppress the rule.

## Offline writes: replay desired state, not authored submissions

For B-239, automatic reconnect replay is limited to reversible latest-state intents such as save/follow/like/reaction/preferences. Persist only strictly validated IDs, target state, and timestamps; coalesce by user/domain/entity so the last intent wins. Authored content, uploads/publishing, safety actions, account/profile edits, and destructive writes must show explicit reconnect recovery and require the user to submit again.

### Optimistic rollback rule

Any component that applies optimistic UI state before calling `runDeferredMutation` must:

1. Capture `previousState` before the optimistic update.
2. Wrap `runDeferredMutation` in try/catch.
3. If `{ queued: true }` is returned, keep the optimistic state — it will be reconciled when `syncEpoch` increments.
4. If the call throws (non-retryable failure), revert to `previousState` immediately.

```typescript
const previousState = localState
setLocalState(optimisticNext)  // apply optimistic update
try {
  await runDeferredMutation(input)
} catch {
  setLocalState(previousState) // revert on permanent failure
}
```

### `syncEpoch` re-fetch pattern

`ConnectivityProvider` exposes `syncEpoch: number` which increments after every successful or partial flush. Data hooks that display optimistic state (`useSavedPosts`, `useLikedPosts`, etc.) subscribe to `syncEpoch` and re-fetch to reconcile server truth:

```typescript
const { syncEpoch } = useConnectivity()
useEffect(() => {
  if (syncEpoch > 0) void fetchFirst()
}, [syncEpoch, fetchFirst])
```

The re-fetch is guarded by the existing `useFocusEffect` + `useCallback([userId])` pattern — `fetchFirst` is stable across renders unless `userId` changes, so the effect only fires once per epoch increment.

### Phase split rationale (B-239 vs B-239b)

Phase 1 enrolls only reversible, idempotent, non-content-bearing mutations: saves, likes, follows, settings. Phase 2 (message reactions, conversation prefs) is deferred to B-239b because those operations require more nuanced conflict resolution (conversation state is relational, not last-write-wins) and the messaging surface has higher privacy sensitivity. Phase 2 screens fall back to `requireOnline()` gate + immediate service call.
