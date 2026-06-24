import { analytics } from '@/lib/analytics'
import { SUPABASE_URL } from '@/lib/config'
import { isModerationResponse } from '@/lib/services/moderationGuards'
import { supabase } from '@/lib/supabase'

export const BLOCKED_ACCOUNTS_LIMIT = 500

export type ReportTargetType = 'post' | 'comment' | 'user' | 'place' | 'message'
export type ReportType =
  | 'content_report'
  | 'fake_review'
  | 'incentive_disclosure'
  | 'dispute'
  | 'takedown'

export type BlockedAccount = {
  blockedUserId: string
  username: string | null
  fullName: string | null
  avatarUrl: string | null
  blockedAt: string
}

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
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    report_type: input.reportType ?? 'content_report',
    reason: input.reason,
    details: input.details?.slice(0, 1000) ?? null,
    source_surface: input.sourceSurface ?? 'app',
  })

  void analytics.abuseSignal(input.reporterId, 'content_report_submitted', input.targetType, input.reportType ?? 'content_report')
  return error?.message ?? null
}

export async function blockUser(
  blockerId: string | null,
  blockedId: string,
  reason = 'user_requested'
): Promise<string | null> {
  const { error } = await supabase.rpc('block_user', {
    p_blocked_id: blockedId,
    p_reason: reason,
  })

  void analytics.abuseSignal(blockerId, 'user_blocked', 'user', reason)
  return error?.message ?? null
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<string | null> {
  const { error } = await supabase.from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)

  void analytics.abuseSignal(blockerId, 'user_unblocked', 'user', 'user_requested')
  return error?.message ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function firstJoinedRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null
  return isRecord(value) ? value : null
}

function parseBlockedAccount(row: unknown): BlockedAccount | null {
  if (!isRecord(row)) return null
  const blockedUserId = row.blocked_id
  const blockedAt = row.created_at
  if (typeof blockedUserId !== 'string' || typeof blockedAt !== 'string') return null

  const user = firstJoinedRow(row.users)
  if (!user) {
    return {
      blockedUserId,
      username: null,
      fullName: null,
      avatarUrl: null,
      blockedAt,
    }
  }

  return {
    blockedUserId,
    username: typeof user.username === 'string' ? user.username : null,
    fullName: typeof user.full_name === 'string' ? user.full_name : null,
    avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : null,
    blockedAt,
  }
}

export async function fetchBlockedAccountCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from('user_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('blocker_id', userId)
    .limit(1)
  if (error) throw error
  return count ?? 0
}

export async function fetchBlockedAccounts(userId: string): Promise<BlockedAccount[]> {
  const { data, error } = await supabase.from('user_blocks')
    .select('blocked_id, created_at, users!user_blocks_blocked_id_fkey(id, username, full_name, avatar_url)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(BLOCKED_ACCOUNTS_LIMIT)
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  return (data ?? [])
    .map(parseBlockedAccount)
    .filter((account): account is BlockedAccount => account !== null)
}

export async function fetchBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId)
    .limit(BLOCKED_ACCOUNTS_LIMIT)
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error

  return (data ?? [])
    .map(row => (isRecord(row) && typeof row.blocked_id === 'string' ? row.blocked_id : null))
    .filter((id): id is string => id !== null)
}

export async function moderateMessageMedia(
  mediaHash: string,
  messageType: 'image' | 'video',
  conversationId: string
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !SUPABASE_URL) return true
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ messageType, mediaHash, conversationId }),
    })
    if (!res.ok) return false
    const result: unknown = await res.json()
    if (!isModerationResponse(result)) return false
    return result.safe
  } catch {
    return false
  }
}
