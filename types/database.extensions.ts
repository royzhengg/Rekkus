import type { Database } from './database'

// Manual type extension for tables added after the last type generation.
// Apply to the supabase client so .from() calls remain fully typed.
// Remove each entry once `npm run db:types` has been re-run and database.ts includes it.

// user_top_spots was added to database.ts in the rename_restaurants_to_places migration update.
// This file is kept for future use.

export type DatabaseWithExtensions = Database
