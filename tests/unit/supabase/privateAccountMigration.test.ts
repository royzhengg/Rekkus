import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260626000002_private_account_activity_visibility.sql'),
  'utf8'
)

describe('private account migration contract', () => {
  it('keeps one active pending request per requester and target', () => {
    expect(migration).toContain('create unique index if not exists follow_requests_one_pending_idx')
    expect(migration).toContain('on public.follow_requests (requester_id, target_id)')
    expect(migration).toContain("where status = 'pending'")
  })

  it('hardens the central content authority function', () => {
    expect(migration).toContain('create or replace function public.can_view_user_content(viewer_id uuid, target_id uuid)')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = public')
    expect(migration).toContain('public.has_user_block_between(viewer_id, target_id)')
    expect(migration).toContain('select us.private_account')
    expect(migration).toContain('where us.id = target_id')
  })

  it('approves requests by updating state and inserting the follow in one RPC', () => {
    const approveStart = migration.indexOf('create or replace function public.approve_follow_request')
    const declineStart = migration.indexOf('create or replace function public.decline_follow_request')
    const approveBody = migration.slice(approveStart, declineStart)

    expect(approveBody).toContain("set status = 'approved'")
    expect(approveBody).toContain("and status = 'pending'")
    expect(approveBody).toContain('insert into public.follows (follower_id, following_id)')
    expect(approveBody).toContain('on conflict (follower_id, following_id) do nothing')
  })

  it('blocking cancels pending requests and removes follow access atomically', () => {
    const blockStart = migration.indexOf('create or replace function public.block_user')
    const activityStart = migration.indexOf('create or replace function public.set_activity_visibility')
    const blockBody = migration.slice(blockStart, activityStart)

    expect(blockBody).toContain('insert into public.user_blocks')
    expect(blockBody).toContain('delete from public.follows')
    expect(blockBody).toContain("set status = 'cancelled'")
    expect(blockBody).toContain("where status = 'pending'")
  })

  it('activity visibility clears stored last_seen_at when disabled', () => {
    const activityStart = migration.indexOf('create or replace function public.set_activity_visibility')
    const visibleStart = migration.indexOf('create or replace function public.visible_last_seen_at')
    const activityBody = migration.slice(activityStart, visibleStart)

    expect(activityBody).toContain('values (actor_id, p_show, now())')
    expect(activityBody).toContain('show_activity_status = excluded.show_activity_status')
    expect(activityBody).toContain('if not p_show then')
    expect(activityBody).toContain('set last_seen_at = null')
  })
})
