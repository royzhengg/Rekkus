import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type Conversation = Tables['conversations']['Row'];
export type ConversationInsert = Tables['conversations']['Insert'];
export type ConversationUpdate = Tables['conversations']['Update'];

export type ConversationParticipant = Tables['conversation_participants']['Row'];
export type ConversationParticipantInsert = Tables['conversation_participants']['Insert'];
export type ConversationParticipantUpdate = Tables['conversation_participants']['Update'];

export type Message = Tables['messages']['Row'];
export type MessageInsert = Tables['messages']['Insert'];
export type MessageUpdate = Tables['messages']['Update'];

export type MessageDelivery = Tables['message_deliveries']['Row'];
export type MessageDeliveryInsert = Tables['message_deliveries']['Insert'];

export type MessageReaction = Tables['message_reactions']['Row'];
export type MessageReactionInsert = Tables['message_reactions']['Insert'];

export type ConversationPinnedMessage = Tables['conversation_pinned_messages']['Row'];
export type ConversationPinnedMessageInsert = Tables['conversation_pinned_messages']['Insert'];
