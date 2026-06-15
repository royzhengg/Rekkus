import { useCallback, useEffect, useState } from 'react'
import {
  fetchCollections,
  fetchPlaceCollectionItems,
  type Collection,
  type CollectionItem,
} from '@/lib/services/collections'

export function useCollections(userId: string | undefined, placeIds: string[]) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCollections([])
      setItems([])
      return
    }
    setLoading(true)
    const nextCollections = await fetchCollections(userId)
    const nextItems = await fetchPlaceCollectionItems(userId, placeIds)
    setCollections(nextCollections)
    setItems(nextItems)
    setLoading(false)
  }, [userId, placeIds])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { collections, items, loading, refresh }
}
