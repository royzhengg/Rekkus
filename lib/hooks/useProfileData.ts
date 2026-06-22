import { useFocusEffect } from 'expo-router'
import { useState, useCallback, useEffect } from 'react'
import type { ProfilePlace } from '@/features/profile/profileIdentity'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import type { Collection } from '@/lib/services/collections'
import { fetchProfileCollections } from '@/lib/services/collections'
import { fetchTopSpotsWithDetails } from '@/lib/services/topSpots'
import {
  fetchFollowCounts,
  fetchProfile,
  removeFollowChannel,
  subscribeToFollowChanges,
  type ProfileInfo,
} from '@/lib/services/users'

export function useProfileData(userId: string | undefined) {
  const { registerSyncListener } = useConnectivity()
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null)
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null)
  const [profileCollections, setProfileCollections] = useState<Collection[]>([])
  const [manualTopSpots, setManualTopSpots] = useState<ProfilePlace[] | null>(null)

  const loadProfileData = useCallback(async () => {
    if (!userId) { setProfileInfo(null); return }
    const data = await fetchProfile(userId)
    if (data) setProfileInfo(data)
  }, [userId])

  const loadFollowCounts = useCallback(async () => {
    if (!userId) { setFollowCounts(null); return }
    try {
      setFollowCounts(await fetchFollowCounts(userId))
    } catch {
      setFollowCounts(null)
    }
  }, [userId])

  const loadProfileCollections = useCallback(async () => {
    if (!userId) { setProfileCollections([]); return }
    try {
      setProfileCollections(await fetchProfileCollections(userId, false))
    } catch {
      setProfileCollections([])
    }
  }, [userId])

  const loadManualTopSpots = useCallback(async () => {
    if (!userId) { setManualTopSpots(null); return }
    setManualTopSpots(await fetchTopSpotsWithDetails(userId))
  }, [userId])

  const loadAll = useCallback(() => Promise.all([
    loadProfileData(),
    loadFollowCounts(),
    loadProfileCollections(),
    loadManualTopSpots(),
  ]), [loadProfileData, loadFollowCounts, loadProfileCollections, loadManualTopSpots])

  useEffect(() => { void loadAll() }, [loadAll])

  useFocusEffect(useCallback(() => { void loadAll() }, [loadAll]))

  useEffect(() => registerSyncListener(() => void loadFollowCounts()), [registerSyncListener, loadFollowCounts])

  useEffect(() => {
    if (!userId) return
    const channel = subscribeToFollowChanges(userId, () => { void loadFollowCounts() })
    return () => { removeFollowChannel(channel) }
  }, [loadFollowCounts, userId])

  return {
    profileInfo,
    followCounts,
    setFollowCounts,
    profileCollections,
    manualTopSpots,
    refresh: loadAll,
  }
}
