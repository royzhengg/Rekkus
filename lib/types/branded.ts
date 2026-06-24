declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type PlaceId = Brand<string, 'PlaceId'>;
export type UserId = Brand<string, 'UserId'>;
export type PostId = Brand<string, 'PostId'>;
export type DishId = Brand<string, 'DishId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type CommentId = Brand<string, 'CommentId'>;
export type SocialEventId = Brand<string, 'SocialEventId'>;

// Constructor helpers — always use these; never cast directly (id as PlaceId is forbidden)
export const asPlaceId = (v: string): PlaceId => v as PlaceId;
export const asUserId = (v: string): UserId => v as UserId;
export const asPostId = (v: string): PostId => v as PostId;
export const asDishId = (v: string): DishId => v as DishId;
export const asCollectionId = (v: string): CollectionId => v as CollectionId;
export const asConversationId = (v: string): ConversationId => v as ConversationId;
export const asMessageId = (v: string): MessageId => v as MessageId;
export const asCommentId = (v: string): CommentId => v as CommentId;
export const asSocialEventId = (v: string): SocialEventId => v as SocialEventId;
