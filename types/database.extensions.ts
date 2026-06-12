import type { Database } from './database'

// Manual type extension for tables added after the last type generation.
// Apply to the supabase client so .from() calls remain fully typed.
// Remove each entry once `npm run db:types` has been re-run and database.ts includes it.

type UserTopSpotsRow = {
  id: string
  user_id: string
  position: number
  restaurant_id: string
  created_at: string
  updated_at: string
}

export type DatabaseWithExtensions = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      user_top_spots: {
        Row: UserTopSpotsRow
        Insert: { id?: string; user_id: string; position: number; restaurant_id: string; created_at?: string; updated_at?: string }
        Update: { position?: number; restaurant_id?: string; updated_at?: string }
        Relationships: []
      }
    }
  }
}
