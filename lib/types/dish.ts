import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type Dish = Tables['dishes']['Row'];
export type DishInsert = Tables['dishes']['Insert'];
export type DishUpdate = Tables['dishes']['Update'];

export type DishEmbedding = Tables['dish_embeddings']['Row'];
export type DishEmbeddingInsert = Tables['dish_embeddings']['Insert'];

export type SavedDish = Tables['saved_dishes']['Row'];
export type SavedDishInsert = Tables['saved_dishes']['Insert'];
