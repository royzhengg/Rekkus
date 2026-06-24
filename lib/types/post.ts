import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type PostRow = Tables['posts']['Row'];
export type PostInsert = Tables['posts']['Insert'];
export type PostUpdate = Tables['posts']['Update'];

export type PostPhoto = Tables['post_photos']['Row'];
export type PostPhotoInsert = Tables['post_photos']['Insert'];

export type PostReaction = Tables['post_reactions']['Row'];
export type PostReactionInsert = Tables['post_reactions']['Insert'];

export type PostEmbedding = Tables['post_embeddings']['Row'];
export type PostEmbeddingInsert = Tables['post_embeddings']['Insert'];

export type PostHashtag = Tables['post_hashtags']['Row'];
export type PostHashtagInsert = Tables['post_hashtags']['Insert'];

export type PostEditEvent = Tables['post_edit_events']['Row'];
export type PostEditEventInsert = Tables['post_edit_events']['Insert'];

export type PostDraft = Tables['post_drafts']['Row'];
export type PostDraftInsert = Tables['post_drafts']['Insert'];
export type PostDraftUpdate = Tables['post_drafts']['Update'];

export type PostDraftMedia = Tables['post_draft_media']['Row'];
export type PostDraftMediaInsert = Tables['post_draft_media']['Insert'];

export type Comment = Tables['comments']['Row'];
export type CommentInsert = Tables['comments']['Insert'];
export type CommentUpdate = Tables['comments']['Update'];

export type Like = Tables['likes']['Row'];
export type LikeInsert = Tables['likes']['Insert'];

export type Save = Tables['saves']['Row'];
export type SaveInsert = Tables['saves']['Insert'];

export type Hashtag = Tables['hashtags']['Row'];
export type HashtagInsert = Tables['hashtags']['Insert'];
