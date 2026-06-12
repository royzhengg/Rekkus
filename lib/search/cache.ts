type CacheEntry<T> = {
  savedAt: number
  value: Promise<T> | T
}

export type SearchMemoryCache<T> = {
  get(key: string, now?: number): Promise<T> | T | null
  set(key: string, value: Promise<T> | T, now?: number): void
  clear(): void
  size(): number
}

export function createSearchMemoryCache<T>({
  maxEntries,
  ttlMs,
}: {
  maxEntries: number
  ttlMs: number
}): SearchMemoryCache<T> {
  const entries = new Map<string, CacheEntry<T>>()

  function prune(now: number): void {
    for (const [key, entry] of entries) {
      if (now - entry.savedAt > ttlMs) entries.delete(key)
    }
    while (entries.size > maxEntries) {
      const firstKey = entries.keys().next().value
      if (typeof firstKey !== 'string') break
      entries.delete(firstKey)
    }
  }

  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key)
      if (!entry) return null
      if (now - entry.savedAt > ttlMs) {
        entries.delete(key)
        return null
      }
      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value, now = Date.now()) {
      entries.set(key, { savedAt: now, value })
      prune(now)
    },
    clear() {
      entries.clear()
    },
    size() {
      return entries.size
    },
  }
}

export function normalizedSearchCacheQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function coarseLocationCacheKey(location: { lat: number; lng: number } | null): string {
  if (!location) return 'none'
  return `${location.lat.toFixed(2)},${location.lng.toFixed(2)}`
}
