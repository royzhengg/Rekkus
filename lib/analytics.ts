import { supabase } from '@/lib/supabase'

type EntityType = 'restaurant' | 'post' | 'user'

type EventPayload = {
  event_type: string
  entity_type?: EntityType
  entity_id?: string
  metadata?: Record<string, unknown>
}

async function track(userId: string | null, payload: EventPayload): Promise<void> {
  try {
    await (supabase.from('analytics_events') as any).insert({
      user_id: userId,
      ...payload,
    })
  } catch {
    // analytics must never crash the app
  }
}

export const analytics = {
  // Post events
  viewPost: (userId: string | null, postId: string) =>
    track(userId, { event_type: 'post_view', entity_type: 'post', entity_id: postId }),

  likePost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_like', entity_type: 'post', entity_id: postId }),

  savePost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_save', entity_type: 'post', entity_id: postId }),

  commentPost: (userId: string, postId: string) =>
    track(userId, { event_type: 'post_comment', entity_type: 'post', entity_id: postId }),

  // Place events
  viewPlace: (userId: string | null, restaurantId: string, query?: string) =>
    track(userId, {
      event_type: 'place_view',
      entity_type: 'restaurant',
      entity_id: restaurantId,
      metadata: { query },
    }),

  clickPlace: (userId: string | null, restaurantId: string) =>
    track(userId, {
      event_type: 'place_click',
      entity_type: 'restaurant',
      entity_id: restaurantId,
    }),

  savePlace: (userId: string, restaurantId: string) =>
    track(userId, { event_type: 'place_save', entity_type: 'restaurant', entity_id: restaurantId }),

  // Search events
  search: (userId: string | null, query: string, resultCount: number) =>
    track(userId, { event_type: 'search', metadata: { query, result_count: resultCount } }),

  // User events
  follow: (userId: string, targetUserId: string) =>
    track(userId, { event_type: 'user_follow', entity_type: 'user', entity_id: targetUserId }),

  screen: (userId: string | null, screenName: string) =>
    track(userId, { event_type: 'screen_view', metadata: { screen: screenName } }),
}
