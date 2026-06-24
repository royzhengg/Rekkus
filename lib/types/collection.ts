import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type CollectionRow = Tables['collections']['Row'];
export type CollectionInsert = Tables['collections']['Insert'];
export type CollectionUpdate = Tables['collections']['Update'];

export type CollectionItem = Tables['collection_items']['Row'];
export type CollectionItemInsert = Tables['collection_items']['Insert'];
