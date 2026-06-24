import AsyncStorage from '@react-native-async-storage/async-storage'
import { analytics } from '@/lib/analytics'
import type { SearchAttribution } from '@/lib/analytics'
import { unsaveTarget } from '@/lib/services/collections'
import { saveDish } from '@/lib/services/dishes'
import {
  addReaction,
  archiveConversation,
  markConversationUnread,
  muteConversationUntil,
  pinConversation,
  removeReaction,
  unarchiveConversation,
  unmuteConversation,
  unpinConversation,
} from '@/lib/services/messaging'
import { savePlace } from '@/lib/services/places'
import {
  togglePostLike,
  togglePostSave,
} from '@/lib/services/posts'
import { updateSettingValue, type Settings } from '@/lib/services/settings'
import { followUser, unfollowUser, type FollowRelationshipState } from '@/lib/services/users'
import { isRecord, parseJsonWithGuard } from '@/lib/utils/safeJson'

// Phase 1 scope: saves, likes, follows, settings.
// Phase 2 (B-239b): message_reaction, conversation_*.

const STORAGE_KEY = 'rekkus:pending-mutations:v1'
const STORAGE_VERSION = 1
const MAX_QUEUE_SIZE = 50
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
export const MAX_RETRY_COUNT = 5

type BaseMutation = {
  userId: string
  updatedAt: string
  retryCount: number
}

export type DeferredMutation =
  | (BaseMutation & { kind: 'post_save'; postId: string; targetState: boolean; removeCollectionMemberships?: boolean; cuisineType?: string | null; searchAttribution?: SearchAttribution | null })
  | (BaseMutation & { kind: 'dish_save'; dishId: string; targetState: boolean; removeCollectionMemberships?: boolean })
  | (BaseMutation & { kind: 'place_save'; placeId: string; targetState: boolean; removeCollectionMemberships?: boolean })
  | (BaseMutation & { kind: 'follow'; targetUserId: string; targetState: boolean })
  | (BaseMutation & { kind: 'post_like'; postId: string; targetState: boolean })
  | (BaseMutation & { kind: 'setting'; setting: keyof Settings; value: Settings[keyof Settings] })
  | (BaseMutation & { kind: 'message_reaction'; messageId: string; emoji: string; targetState: boolean })
  | (BaseMutation & { kind: 'conversation_mute'; conversationId: string; mutedUntil: string })
  | (BaseMutation & { kind: 'conversation_unmute'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_archive'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_unarchive'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_pin'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_unpin'; conversationId: string })
  | (BaseMutation & { kind: 'conversation_unread'; conversationId: string })

export type DeferredMutationInput = DeferredMutation extends infer T
  ? T extends DeferredMutation
    ? Omit<T, 'userId' | 'updatedAt' | 'retryCount'>
    : never
  : never

type MutationEnvelope = {
  version: 1
  mutations: DeferredMutation[]
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key))
}

function isSettingValue(key: string, value: unknown): value is Settings[keyof Settings] {
  if (key === 'theme_mode') return value === 'light' || value === 'dark' || value === 'system'
  return isBoolean(value)
}

function isSearchAttribution(value: unknown): value is SearchAttribution {
  return isRecord(value) &&
    typeof value.searchSessionId === 'string' &&
    typeof value.query === 'string' &&
    typeof value.resultPosition === 'number' &&
    (value.resultType === 'post' ||
      value.resultType === 'place' ||
      value.resultType === 'user' ||
      value.resultType === 'dish')
}

const BASE_KEYS = ['kind', 'userId', 'updatedAt', 'retryCount']

export function isDeferredMutation(value: unknown): value is DeferredMutation {
  if (!isRecord(value) || typeof value.userId !== 'string' || typeof value.updatedAt !== 'string' ||
      typeof value.kind !== 'string' || typeof value.retryCount !== 'number') {
    return false
  }
  switch (value.kind) {
    case 'post_save':
      return hasOnlyKeys(value, [...BASE_KEYS, 'postId', 'targetState', 'removeCollectionMemberships', 'cuisineType', 'searchAttribution']) &&
        typeof value.postId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships)) &&
        (value.cuisineType === undefined || value.cuisineType === null || typeof value.cuisineType === 'string') &&
        (value.searchAttribution === undefined ||
          value.searchAttribution === null ||
          isSearchAttribution(value.searchAttribution))
    case 'dish_save':
      return hasOnlyKeys(value, [...BASE_KEYS, 'dishId', 'targetState', 'removeCollectionMemberships']) &&
        typeof value.dishId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships))
    case 'place_save':
      return hasOnlyKeys(value, [...BASE_KEYS, 'placeId', 'targetState', 'removeCollectionMemberships']) &&
        typeof value.placeId === 'string' && isBoolean(value.targetState) &&
        (value.removeCollectionMemberships === undefined || isBoolean(value.removeCollectionMemberships))
    case 'follow':
      return hasOnlyKeys(value, [...BASE_KEYS, 'targetUserId', 'targetState']) &&
        typeof value.targetUserId === 'string' && isBoolean(value.targetState)
    case 'post_like':
      return hasOnlyKeys(value, [...BASE_KEYS, 'postId', 'targetState']) &&
        typeof value.postId === 'string' && isBoolean(value.targetState)
    case 'setting':
      return hasOnlyKeys(value, [...BASE_KEYS, 'setting', 'value']) &&
        typeof value.setting === 'string' && value.setting in {
        notif_likes: true, notif_comments: true, notif_followers: true, notif_mentions: true,
        notif_messages: true, private_account: true, allow_comments: true, allow_tags: true,
        show_activity_status: true,
        autoplay_videos: true, theme_mode: true,
      } && isSettingValue(value.setting, value.value)
    case 'message_reaction':
      return hasOnlyKeys(value, [...BASE_KEYS, 'messageId', 'emoji', 'targetState']) &&
        typeof value.messageId === 'string' && typeof value.emoji === 'string' && isBoolean(value.targetState)
    case 'conversation_mute':
      return hasOnlyKeys(value, [...BASE_KEYS, 'conversationId', 'mutedUntil']) &&
        typeof value.conversationId === 'string' && typeof value.mutedUntil === 'string'
    case 'conversation_unmute':
    case 'conversation_archive':
    case 'conversation_unarchive':
    case 'conversation_pin':
    case 'conversation_unpin':
    case 'conversation_unread':
      return hasOnlyKeys(value, [...BASE_KEYS, 'conversationId']) && typeof value.conversationId === 'string'
    default:
      return false
  }
}

function isEnvelope(value: unknown): value is MutationEnvelope {
  return isRecord(value) && value.version === STORAGE_VERSION && Array.isArray(value.mutations) &&
    value.mutations.every(isDeferredMutation)
}

function deferredMutationKey(mutation: DeferredMutation): string {
  switch (mutation.kind) {
    case 'post_save': return `${mutation.userId}:post_save:${mutation.postId}`
    case 'dish_save': return `${mutation.userId}:dish_save:${mutation.dishId}`
    case 'place_save': return `${mutation.userId}:place_save:${mutation.placeId}`
    case 'follow': return `${mutation.userId}:follow:${mutation.targetUserId}`
    case 'post_like': return `${mutation.userId}:post_like:${mutation.postId}`
    case 'setting': return `${mutation.userId}:setting:${mutation.setting}`
    case 'message_reaction': return `${mutation.userId}:message_reaction:${mutation.messageId}`
    case 'conversation_mute':
    case 'conversation_unmute':
    case 'conversation_archive':
    case 'conversation_unarchive':
    case 'conversation_pin':
    case 'conversation_unpin':
    case 'conversation_unread':
      return `${mutation.userId}:${mutation.kind}:${mutation.conversationId}`
  }
}

export function deferredMutationDomain(mutation: DeferredMutation): string {
  return mutation.kind
}

export function incrementRetryCount(mutation: DeferredMutation): DeferredMutation {
  return { ...mutation, retryCount: mutation.retryCount + 1 }
}

function pruneExpired(mutations: DeferredMutation[]): DeferredMutation[] {
  const now = Date.now()
  return mutations.filter(m => now - Date.parse(m.updatedAt) <= QUEUE_TTL_MS)
}

export async function readDeferredMutations(userId?: string): Promise<DeferredMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = parseJsonWithGuard(raw, isEnvelope)
    if (!parsed) {
      // Attempt partial salvage: try to recover individually valid items from the raw array
      try {
        const obj = JSON.parse(raw) as unknown
        if (isRecord(obj) && Array.isArray(obj.mutations)) {
          const salvaged = (obj.mutations as unknown[]).filter(isDeferredMutation)
          if (salvaged.length > 0) {
            const pruned = pruneExpired(salvaged)
            await writeDeferredMutations(pruned)
            analytics.actionError(null, 'runtime_boundary', 'pending_mutations_partial_recovery')
            return userId ? pruned.filter(m => m.userId === userId) : pruned
          }
        }
      } catch {
        // unparseable — drop all
      }
      analytics.actionError(null, 'runtime_boundary', 'pending_mutations_invalid')
      await AsyncStorage.removeItem(STORAGE_KEY)
      return []
    }
    const pruned = pruneExpired(parsed.mutations)
    if (pruned.length !== parsed.mutations.length) {
      await writeDeferredMutations(pruned)
    }
    return userId ? pruned.filter(m => m.userId === userId) : pruned
  } catch {
    return []
  }
}

async function writeDeferredMutations(mutations: DeferredMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, mutations }))
  } catch {
    analytics.actionError(null, 'runtime_boundary', 'pending_mutations_write_failed')
    throw new Error('offline_queue_write_failed')
  }
}

export async function enqueueDeferredMutation(mutation: DeferredMutation): Promise<void> {
  const mutations = await readDeferredMutations()
  const key = deferredMutationKey(mutation)
  const idx = mutations.findIndex(item => deferredMutationKey(item) === key)
  if (idx >= 0) {
    mutations[idx] = mutation  // update in place — preserve FIFO position
  } else {
    if (mutations.length >= MAX_QUEUE_SIZE) throw new Error('offline_queue_full')
    mutations.push(mutation)
  }
  await writeDeferredMutations(mutations)
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

export async function executeDeferredMutation(mutation: DeferredMutation): Promise<void | FollowRelationshipState> {
  switch (mutation.kind) {
    case 'post_save':
      if (mutation.targetState) await togglePostSave(
        mutation.postId,
        mutation.userId,
        true,
        mutation.cuisineType,
        mutation.searchAttribution
      )
      else await unsaveTarget('post', mutation.postId, mutation.removeCollectionMemberships ?? false)
      return
    case 'dish_save':
      if (mutation.targetState) await saveDish(mutation.userId, mutation.dishId)
      else await unsaveTarget('dish', mutation.dishId, mutation.removeCollectionMemberships ?? false)
      return
    case 'place_save':
      if (mutation.targetState) await savePlace(mutation.userId, mutation.placeId)
      else await unsaveTarget('place', mutation.placeId, mutation.removeCollectionMemberships ?? false)
      return
    case 'follow':
      if (mutation.targetState) return followUser(mutation.userId, mutation.targetUserId)
      else await unfollowUser(mutation.userId, mutation.targetUserId)
      return
    case 'post_like':
      await togglePostLike(mutation.postId, mutation.userId, mutation.targetState)
      return
    case 'setting':
      await updateSettingValue(mutation.userId, mutation.setting, mutation.value)
      return
    case 'message_reaction':
      if (mutation.targetState) await addReaction(mutation.messageId, mutation.emoji)
      else await removeReaction(mutation.messageId, mutation.userId)
      return
    case 'conversation_mute':
      await muteConversationUntil(mutation.conversationId, mutation.userId, mutation.mutedUntil)
      return
    case 'conversation_unmute':
      await unmuteConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_archive':
      await archiveConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_unarchive':
      await unarchiveConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_pin':
      await pinConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_unpin':
      await unpinConversation(mutation.conversationId, mutation.userId)
      return
    case 'conversation_unread':
      await markConversationUnread(mutation.conversationId, mutation.userId)
      return
  }
}
