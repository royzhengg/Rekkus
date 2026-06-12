import * as MediaLibrary from 'expo-media-library'
import { useEffect, useRef, useState } from 'react'

type UseRecentPhotosParams = {
  enabled: boolean
  limit?: number
}

export type RecentPhoto = {
  id: string
  uri: string
  width: number
  height: number
  filename?: string
}

type UseRecentPhotosResult = {
  photos: RecentPhoto[]
  loading: boolean
  denied: boolean
  error: string | null
}

export function useRecentPhotos({
  enabled,
  limit = 5,
}: UseRecentPhotosParams): UseRecentPhotosResult {
  const [photos, setPhotos] = useState<RecentPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (!enabled) {
      setPhotos([])
      setLoading(false)
      setDenied(false)
      setError(null)
      return
    }

    setLoading(true)
    setDenied(false)
    setError(null)

    void (async () => {
      try {
        const permission = await MediaLibrary.getPermissionsAsync(false)
        if (requestIdRef.current !== requestId) return
        if (!permission.granted) {
          setPhotos([])
          setDenied(true)
          setLoading(false)
          return
        }

        const result = await MediaLibrary.getAssetsAsync({
          first: limit,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [MediaLibrary.SortBy.creationTime],
          resolveWithFullInfo: true,
        })
        if (requestIdRef.current !== requestId) return
        setPhotos(
          result.assets.map(asset => ({
            id: asset.id,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            ...(asset.filename ? { filename: asset.filename } : {}),
          }))
        )
        setLoading(false)
      } catch (e) {
        if (requestIdRef.current !== requestId) return
        setPhotos([])
        setError(e instanceof Error ? e.message : 'Could not load recent photos.')
        setLoading(false)
      }
    })()

    return () => {
        if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [enabled, limit])

  return { photos, loading, denied, error }
}
