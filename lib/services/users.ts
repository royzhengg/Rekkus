import { supabase } from '@/lib/supabase'

export type ProfileInfo = {
  full_name: string | null
  bio: string | null
  suburb: string | null
  city: string | null
  country: string | null
}

export async function fetchProfile(userId: string): Promise<ProfileInfo | null> {
  const { data } = await (supabase.from('users') as any)
    .select('full_name, bio, suburb, city, country')
    .eq('id', userId)
    .single()
  return data ?? null
}

export async function updateProfile(userId: string, updates: Partial<ProfileInfo>): Promise<void> {
  await (supabase.from('users') as any).upsert({ id: userId, ...updates })
}
