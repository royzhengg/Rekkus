import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];

export type ContentReport = Tables['content_reports']['Row'];
export type ContentReportInsert = Tables['content_reports']['Insert'];
export type ContentReportUpdate = Tables['content_reports']['Update'];

export type ModerationAction = Tables['moderation_actions']['Row'];
export type ModerationActionInsert = Tables['moderation_actions']['Insert'];

export type ModerationAppeal = Tables['moderation_appeals']['Row'];
export type ModerationAppealInsert = Tables['moderation_appeals']['Insert'];
export type ModerationAppealUpdate = Tables['moderation_appeals']['Update'];
