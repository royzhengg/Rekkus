import { useState, useMemo, useCallback } from 'react'

export function usePagedList<T>(items: T[], pageSize = 30) {
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const visible = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])
  const hasMore = items.length > visibleCount
  const loadMore = useCallback(() => setVisibleCount(c => c + pageSize), [pageSize])
  return { visible, hasMore, loadMore }
}
