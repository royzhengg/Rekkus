import { useEffect, useRef } from 'react'

interface SubscriptionChannel {
  unsubscribe(): Promise<string>
}

export function useRealtimeSubscription<T extends SubscriptionChannel = SubscriptionChannel>(
  enabled: boolean,
  subscribe: () => T,
  deps: React.DependencyList,
  cleanup?: (channel: T) => void
): void {
  const subscribeRef = useRef(subscribe)
  subscribeRef.current = subscribe
  const cleanupRef = useRef(cleanup)
  cleanupRef.current = cleanup

  const depsVersion = useRef(0)
  const prevDeps = useRef<React.DependencyList>([])
  if (
    deps.length !== prevDeps.current.length ||
    deps.some((d, i) => d !== prevDeps.current[i])
  ) {
    depsVersion.current++
    prevDeps.current = deps
  }
  const depsVer = depsVersion.current

  useEffect(() => {
    if (!enabled) return
    const channel = subscribeRef.current()
    return () => {
      if (cleanupRef.current) cleanupRef.current(channel)
      else void channel.unsubscribe()
    }
  }, [enabled, depsVer])
}
