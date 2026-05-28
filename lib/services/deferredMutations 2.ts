import AsyncStorage from '@react-native-async-storage/async-storage'
import { analytics } from '@/lib/analytics'
import { unsaveTarget, updateSavedLocationStatus } from '@/lib/services/collections'
import { saveDish } from '@/lib/services/dishes'
import {
  addReaction as addMessageReaction,
  archiveConversation,
  markConversationUnread,
  muteConversation,
  pinConversation,
  removeReaction as removeMessageReaction,
  unarchiveConversation,
  unmuteConversation,
  unpinConversation,
} from '@/lib/services/messaging'
import {
  addPostReaction,
  removePostReaction,
  togglePostLike,
  togglePostSave,
} from '@/lib/services/posts'
import { saveLocation } from '@/lib/services/restaurants'
import { updateSettingValue, type Settings } from '@/lib/services/settings'
import { followUser, unfollowUser } from '@/lib/services/users'
import { isRecord, parseJsonWithGuard } from '@/lib/utils/safeJson'
import type { PostReactionType } from '@/lib/services/posts'
import type { MuteDuration } from '@/lib/services/messaging'

const STORAGE_KEY = 'rekkus:pending-mutations:v1'
const STORAGE_VERSION = 1

type BaseMutation = {
  userId: string
  updatedAt: string
}

export type DeferredMutation =
  | (BaseMutation & { kind: 'post_save'; postId: string; targetState: boolean; removeCollectionMemberships?: boolean })
  | (BaseMutation & { kind: 'dish_save'; dishId: string; targetState: boolean; removeCollectionMemberships?: boolean })
  | (BaseMutation & { kind: 'place_save'; restaurantId: string; targetState: boolean; removeCollectionMemberships?: boolean })
  | (BaseMutation & { kind: 'place_status'; savedLocationId: string; status: 'want_to_try' | 'been_here' })
  | (BaseMutation & { kind: 'follow'; targetUserId: string; targetState: boolean })
  | (BaseMutation & { kind: 'post_like'; postId: string; targetState: boolean })
  | (BaseMutation & { kind: 'post_reaction'; postId: string; reactionType: PostReactionType; targetState: boolean })
  | (BaseMutation & { kind: 'message_reaction'; messageId: string; emoji: string; targetState: boolean })
  | (BaseMutation & { kind: 'conversation_pinned'; conversationId: string; targetState: boolean })
  | (BaseMutation & { kind: 'conversation_archived'; conversationId: string; targetState: boolean })
  | (BaseMutation & { kind: 'conversation_unread'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_muted'; conversationId: string; duration: MuteDuration | null })
  | (BaseMutation & { kind: 'setting'; setting: keyof Settings; value: Settings[keyof Settings] })

export type DeferredMutationInput = DeferredMutation extends infer T
  ? T extends DeferredMutation
    ? Omit<T, 'userId' | 'updatedAt'>
    : never
  : never

type MutationEnvelope = {
  version: 1
  mutations: DeferredMutation[]
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isPostReaction(value: unknown): value is PostReactionType {
  return value === 'helpful' || value === 'love' || value === 'thanks' || value === 'oh_no'
}

function isMuteDuration(value: unknown): value is MuteDuration {
  return value === '1h' || value === '8h' || value === '24h' || value === '1w' || value === 'forever'
}

function isSettingValue(key: string, value: unknown): value is Settings[keyof Settings] {
  if (key === 'theme_mode') return value === 'light' || value === 'dark' || value === 'system'
  return isBoolean(value)
}

export function isDeferredMutation(value: unknown): value is DeferredMutation {
  if (!isRecord(value) || typeof value.userId !== 'string' || typeof value.updatedAt !== 'string' || typeof value.kind !== 'string') {
    return false
  }
  switch (value.kind) {
    case 'post_save':
      return typeof value.postId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships))
    case 'dish_save':
      return typeof value.dishId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships))
    case 'place_save':
      return typeof value.restaurantId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships))
    case 'place_status':
      return typeof value.savedLocationId === 'string' && (value.status === 'want_to_try' || value.status === 'been_here')
    case 'follow':
      return typeof value.targetUserId === 'string' && isBoolean(value.targetState)
    case 'post_like':
      return typeof value.postId === 'string' && isBoolean(value.targetState)
    case 'post_reaction':
      return typeof value.postId === 'string' && isPostReaction(value.reactionType) && isBoolean(value.targetState)
    case 'message_reaction':
      return typeof value.messageId === 'string' && typeof value.emoji === 'string' && isBoolean(value.targetState)
    case 'conversation_pinned':
    case 'conversation_archived':
      return typeof value.conversationId === 'string' && isBoolean(value.targetState)
    case 'conversation_unread':
      return typeof value.conversationId === 'string'
    case 'conversation_muted':
      return typeof value.conversationId === 'string' && (value.duration === null || isMuteDuration(value.duration))
    case 'setting':
      return typeof value.setting === 'string' && value.setting in {
        notif_likes: true, notif_comments: true, notif_followers: true, notif_mentions: true,
        notif_messages: true, private_account: true, allow_comments: true, allow_tags: true,
        autoplay_videos: true, theme_mode: true,
      } && isSettingValue(value.setting, value.value)
    default:
      return false
  }
}

function isEnvelope(value: unknown): value is MutationEnvelope {
  return isRecord(value) && value.version === STORAGE_VERSION && Array.isArray(value.mutations) &&
    value.mutations.every(isDeferredMutation)
}

export function deferredMutationKey(mutation: DeferredMutation): string {
  switch (mutation.kind) {
    case 'post_save': return `${mutation.userId}:post_save:${mutation.postId}`
    case 'dish_save': return `${mutation.userId}:dish_save:${mutation.dishId}`
    case 'place_save': return `${mutation.userId}:place_save:${mutation.restaurantId}`
    case 'place_status': return `${mutation.userId}:place_status:${mutation.savedLocationId}`
    case 'follow': return `${mutation.userId}:follow:${mutation.targetUserId}`
    case 'post_like': return `${mutation.userId}:post_like:${mutation.postId}`
    case 'post_reaction': return `${mutation.userId}:post_reaction:${mutation.postId}:${mutation.reactionType}`
    case 'message_reaction': return `${mutation.userId}:message_reaction:${mutation.messageId}`
    case 'conversation_pinned': return `${mutation.userId}:conversation_pinned:${mutation.conversationId}`
    case 'conversation_archived': return `${mutation.userId}:conversation_archived:${mutation.conversationId}`
    case 'conversation_unread': return `${mutation.userId}:conversation_unread:${mutation.conversationId}`
    case 'conversation_muted': return `${mutation.userId}:conversation_muted:${mutation.conversationId}`
    case 'setting': return `${mutation.userId}:setting:${mutation.setting}`
  }
}

export function deferredMutationDomain(mutation: DeferredMutation): string {
  return mutation.kind
}

export async function readDeferredMutations(userId?: string): Promise<DeferredMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = parseJsonWithGuard(raw, isEnvelope)
    if (!parsed) {
      analytics.actionError(null, 'runtime_boundary', 'pending_mutations_invalid')
      return []
    }
    return userId ? parsed.mutations.filter(mutation => mutation.userId === userId) : parsed.mutations
  } catch {
    return []
  }
}

async function writeDeferredMutations(mutations: DeferredMutation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, mutations }))
}

export async function enqueueDeferredMutation(mutation: DeferredMutation): Promise<void> {
  const mutations = await readDeferredMutations()
  const key = deferredMutationKey(mutation)
  const next = mutations.filter(item => deferredMutationKey(item) !== key)
  next.push(mutation)
  await writeDeferredMutations(next)
}

export async function removeDeferredMutation(mutation: DeferredMutation): Promise<void> {
  const mutations = await readDeferredMutations()
  await writeDeferredMutations(mutations.filter(item => deferredMutationKey(item) !== deferredMutationKey(mutation)))
}

export async function clearDeferredMutationsForUser(userId: string): Promise<void> {
  const mutations = await readDeferredMutations()
  await writeDeferredMutations(mutations.filter(item => item.userId !== userId))
}

export function isRetryableDeferredMutationError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason)
  return /network|fetch|offline|timeout|timed out|connection|socket/i.test(message)
}

export async function executeDeferredMutation(mutation: DeferredMutation): Promise<void> {
  switch (mutation.kind) {
    case 'post_save':
      if (mutation.targetState) await togglePostSave(mutation.postId, mutation.userId, true)
      else await unsaveTarget('post', mutation.postId, mutation.removeCollectionMemberships ?? false)
      return
    case 'dish_save':
      if (mutation.targetState) await saveDish(mutation.userId, mutation.dishId)
      else await unsaveTarget('dish', mutation.dishId, mutation.removeCollectionMemberships ?? false)
      return
    case 'place_save':
      if (mutation.targetState) await saveLocation(mutation.userId, mutation.restaurantId)
      else await unsaveTarget('restaurant', mutation.restaurantId, mutation.removeCollectionMemberships ?? false)
      return
    case 'place_status': {
      const error = await updateSavedLocationStatus(mutation.savedLocationId, mutation.status)
      if (error) throw new Error(error)
      return
    }
    case 'follow':
      if (mutation.targetState) await followUser(mutation.userId, mutation.targetUserId)
      else await unfollowUser(mutation.userId, mutation.targetUserId)
      return
    case 'post_like':
      await togglePostLike(mutation.postId, mutation.userId, mutation.targetState)
      return
    case 'post_reaction':
      if (mutation.targetState) await addPostReaction(mutation.postId, mutation.userId, mutation.reactionType)
      else await removePostReaction(mutation.postId, mutation.userId, mutation.reactionType)
      return
    case 'message_reaction': {
      const result = mutation.targetState
        ? await addMessageReaction(mutation.messageId, mutation.emoji)
        : await removeMessageReaction(mutation.messageId)
      if (result.error) throw new Error(result.error)
      return
    }
    case 'conversation_pinned':
      if (mutation.targetState) await pinConversation(mutation.conversationId, mutation.userId)
      else await unpinConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_archived':
      if (mutation.targetState) await archiveConversation(mutation.conversationId, mutation.userId)
      else await unarchiveConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_unread':
      await markConversationUnread(mutation.conversationId, mutation.userId)
      return
    case 'conversation_muted':
      if (mutation.duration) await muteConversation(mutation.conversationId, mutation.userId, mutation.duration)
      else await unmuteConversation(mutation.conversationId, mutation.userId)
      return
    case 'setting':
      await updateSettingValue(mutation.userId, mutation.setting, mutation.value)
  }
}
