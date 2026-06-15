import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { isEnabled } from '@/lib/featureFlags'
import { routes } from '@/lib/routes'
import { getOrCreateDirectConversation } from '@/lib/services/messaging'
import { blockUser, submitContentReport } from '@/lib/services/moderation'
import { fetchFollowCounts } from '@/lib/services/users'

export type ActionError = { title: string; message: string }
export type ActionNotice = { title: string; subtitle?: string }
export type ActionFeedback =
  | { kind: 'error'; error: ActionError }
  | { kind: 'notice'; notice: ActionNotice }
  | { kind: 'none' }

export function useUserActions(targetUserId: string | null | undefined) {
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { requireOnline, runDeferredMutation } = useConnectivity()
  const router = useRouter()
  const [startingMessage, setStartingMessage] = useState(false)

  const follow = useCallback(async (
    currentlyFollowing: boolean,
    setFollowing: (v: boolean) => void,
    setFollowCounts: (updater: (prev: { followers: number; following: number } | null) => { followers: number; following: number } | null) => void
  ): Promise<ActionFeedback> => {
    if (!user) { requireAuth(); return { kind: 'none' } }
    if (!targetUserId) return { kind: 'none' }
    const next = !currentlyFollowing
    setFollowing(next)
    try {
      const result = await runDeferredMutation({ kind: 'follow', targetUserId, targetState: next })
      if (!result.queued) {
        const counts = await fetchFollowCounts(targetUserId)
        setFollowCounts(() => counts)
      } else {
        setFollowCounts(prev => prev
          ? { ...prev, followers: Math.max(0, prev.followers + (next ? 1 : -1)) }
          : prev)
      }
      return { kind: 'none' }
    } catch {
      setFollowing(currentlyFollowing)
      return { kind: 'error', error: { title: 'Could not update follow', message: 'Check your connection and try again.' } }
    }
  }, [user, targetUserId, requireAuth, runDeferredMutation])

  const reportUser = useCallback(async (): Promise<ActionFeedback> => {
    if (!user) { requireAuth(); return { kind: 'none' } }
    if (!targetUserId) return { kind: 'error', error: { title: 'Not available', message: 'We could not find this user right now.' } }
    if (!requireOnline()) return { kind: 'error', error: { title: 'You are offline', message: 'Reconnect to report or block this account.' } }
    const err = await submitContentReport({
      reporterId: user.id,
      targetType: 'user',
      targetId: targetUserId,
      reason: 'profile_or_behavior_issue',
      sourceSurface: 'user_profile',
    })
    if (err) return { kind: 'error', error: { title: 'Report failed', message: err } }
    return { kind: 'notice', notice: { title: 'Report received', subtitle: 'Thanks. We will review this profile.' } }
  }, [user, targetUserId, requireAuth, requireOnline])

  const blockUserAction = useCallback(async (): Promise<ActionFeedback> => {
    if (!user) { requireAuth(); return { kind: 'none' } }
    if (!targetUserId) return { kind: 'error', error: { title: 'Not available', message: 'We could not find this user right now.' } }
    if (!requireOnline()) return { kind: 'error', error: { title: 'You are offline', message: 'Reconnect to report or block this account.' } }
    const err = await blockUser(user.id, targetUserId)
    if (err) return { kind: 'error', error: { title: 'Block failed', message: err } }
    return { kind: 'notice', notice: { title: 'User blocked', subtitle: 'You will have a record of this block for moderation review.' } }
  }, [user, targetUserId, requireAuth, requireOnline])

  const startDirectMessage = useCallback(async (): Promise<ActionFeedback & { conversationId?: string }> => {
    if (!user) { requireAuth(); return { kind: 'none' } }
    if (!targetUserId) return { kind: 'error', error: { title: 'Not available', message: 'We could not find this user right now.' } }
    if (!requireOnline()) return { kind: 'error', error: { title: 'You are offline', message: 'Reconnect to start a conversation.' } }
    if (!isEnabled('directMessages')) return { kind: 'notice', notice: { title: 'Messaging is not ready yet', subtitle: 'Rekkus is keeping private messages paused until the release checks finish.' } }
    if (startingMessage) return { kind: 'none' }
    setStartingMessage(true)
    const { conversationId, error } = await getOrCreateDirectConversation(user.id, targetUserId)
    setStartingMessage(false)
    if (error || !conversationId) return { kind: 'error', error: { title: 'Message unavailable', message: error ?? 'We could not open this conversation right now.' } }
    router.push(routes.conversation(conversationId))
    return { kind: 'none', conversationId }
  }, [user, targetUserId, requireAuth, requireOnline, startingMessage, router])

  return { follow, reportUser, blockUser: blockUserAction, startDirectMessage, startingMessage }
}
