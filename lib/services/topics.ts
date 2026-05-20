import { supabase } from '@/lib/supabase'

export const ONBOARDING_TOPICS = [
  'japanese',
  'korean',
  'chinese',
  'italian',
  'thai',
  'mexican',
  'brunch',
  'cheap eats',
  'date night',
  'dessert',
  'vegetarian',
  'hidden gems',
]

export async function saveTopicFollows(
  userId: string,
  topics: string[],
  source: 'onboarding' | 'profile' | 'search' | 'system' = 'onboarding'
): Promise<void> {
  const unique = [...new Set(topics.map(t => t.trim().toLowerCase()).filter(Boolean))]
  if (unique.length === 0) return
  await (supabase.from('user_topic_follows') as any).upsert(
    unique.map(topic => ({ user_id: userId, topic, source })),
    { onConflict: 'user_id,topic' }
  )
}

export async function fetchTopicFollows(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('user_topic_follows') as any)
    .select('topic')
    .eq('user_id', userId)
    .limit(100)
  return data?.map((row: any) => row.topic).filter(Boolean) ?? []
}
