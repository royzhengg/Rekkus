import { useCallback, useEffect, useState } from 'react'
import {
  addTargetToCollection,
  createPrivateCollection,
  fetchCollections,
  type Collection,
} from '@/lib/services/collections'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import type { CollectionTargetType } from '@/types/domain'

export function useCollectionPicker(
  userId: string | undefined,
  targetType: CollectionTargetType,
  targetId: string | undefined
) {
  const { requireOnline } = useConnectivity()
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCollections([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      setCollections(await fetchCollections(userId))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load collections.')
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = useCallback(async (collectionId: string) => {
    if (!targetId) return
    if (!requireOnline()) throw new Error('Reconnect to update collections.')
    await addTargetToCollection(collectionId, targetType, targetId)
  }, [requireOnline, targetId, targetType])

  const createAndAdd = useCallback(async (name: string) => {
    if (!userId || !targetId) return
    if (!requireOnline()) throw new Error('Reconnect to create collections.')
    const collection = await createPrivateCollection(userId, name)
    await addTargetToCollection(collection.id, targetType, targetId)
    setCollections(previous => [collection, ...previous])
    return collection
  }, [requireOnline, targetId, targetType, userId])

  return { collections, loading, error, refresh, add, createAndAdd }
}
