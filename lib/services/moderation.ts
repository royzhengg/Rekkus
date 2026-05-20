import { supabase } from '@/lib/supabase'
import { analytics } from '@/lib/analytics'

export type ReportTargetType = 'post' | 'comment' | 'user' | 'restaurant' | 'message'
export type ReportType =
  | 'content_report'
  | 'fake_review'
  | 'incentive_disclosure'
  | 'dispute'
  | 'takedown'

type SubmitReportInput = {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: string
  reportType?: ReportType
  details?: string
  sourceSurface?: string
}

export async function submitContentReport(input: SubmitReportInput): Promise<string | null> {
  const { error } = await (supabase.from('content_reports') as any).insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    report_type: input.reportType ?? 'content_report',
    reason: input.reason,
    details: input.details?.slice(0, 1000) ?? null,
    source_surface: input.sourceSurface ?? 'app',
  })

  analytics.abuseSignal(input.reporterId, 'content_report_submitted', input.targetType, input.reportType ?? 'content_report')
  return error?.message ?? null
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason = 'user_requested'
): Promise<string | null> {
  const { error } = await (supabase.from('user_blocks') as any).upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
      reason,
    },
    { onConflict: 'blocker_id,blocked_id' }
  )

  analytics.abuseSignal(blockerId, 'user_blocked', 'user', reason)
  return error?.message ?? null
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<string | null> {
  const { error } = await (supabase.from('user_blocks') as any)
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  analytics.abuseSignal(blockerId, 'user_unblocked', 'user', 'user_requested')
  return error?.message ?? null
}

export async function fetchBlockedUserIds(userId: string): Promise<string[]> {
  const { data } = await (supabase.from('user_blocks') as any)
    .select('blocked_id')
    .eq('blocker_id', userId)

  return (data ?? []).map((row: { blocked_id: string }) => row.blocked_id)
}
