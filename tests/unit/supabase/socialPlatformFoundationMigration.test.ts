import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260626000007_social_platform_foundation.sql'),
  'utf8'
)

function readDoc(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('social platform foundation migration contract', () => {
  it('creates typed activity-ledger and delivery tables', () => {
    expect(migration).toContain('create type public.social_event_type as enum')
    expect(migration).toContain('create type public.follow_request_approval_source as enum')
    expect(migration).toContain('create table if not exists public.social_events')
    expect(migration).toContain('create table if not exists public.notification_deliveries')
    expect(migration).toContain('create table if not exists public.privacy_audit_events')
  })

  it('enforces core database invariants', () => {
    expect(migration).toContain("where status = 'pending'")
    expect(migration).toContain('follows_no_self_follow')
    expect(migration).toContain('follow_requests_no_self_request')
    expect(migration).toContain('follow_requests_approved_source_required')
    expect(migration).toContain('follow_requests_terminal_resolved_at')
    expect(migration).toContain('unique (source_type, source_id, event_type)')
    expect(migration).toContain('unique (social_event_id, recipient_id)')
  })

  it('keeps social events append-only except read state', () => {
    expect(migration).toContain('No direct client social event writes')
    expect(migration).toContain('No direct client social event deletes')
    expect(migration).toContain('Users can mark their social events read')
    expect(migration).toContain('with check (target_user_id = auth.uid()')
    expect(migration).toContain('social_events_append_only')
    expect(migration).toContain('old.actor_id is distinct from new.actor_id')
  })

  it('uses transactional security-definer RPCs with search path hardening', () => {
    expect(migration).toContain('create or replace function public.approve_follow_request')
    expect(migration).toContain('create or replace function public.approve_all_follow_requests')
    expect(migration).toContain('create or replace function public.set_account_privacy')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = public')
    expect(migration).toContain('correlation_id')
  })

  it('guards follow request spam at the RPC boundary', () => {
    const requestStart = migration.indexOf('create or replace function public.request_follow')
    const approveStart = migration.indexOf('drop function if exists public.approve_follow_request')
    const requestBody = migration.slice(requestStart, approveStart)

    expect(requestBody).toContain("created_at >= now() - interval '1 hour'")
    expect(requestBody).toContain("created_at >= now() - interval '1 day'")
    expect(requestBody).toContain('follow_request_rate_limited')
  })

  it('links social events, deliveries, and audit rows through source ids', () => {
    expect(migration).toContain('source_type    public.social_event_source_type not null')
    expect(migration).toContain('source_id      uuid not null')
    expect(migration).toContain('perform public.create_social_event')
    expect(migration).toContain('perform public.enqueue_social_event_delivery')
    expect(migration).toContain('public.privacy_audit_events')
    expect(migration).toContain('platform_audit_events_view')
  })

  it('documents the social source-of-truth contract', () => {
    expect(readDoc('docs/domains/social/ownership.md')).toContain('follows')
    expect(readDoc('docs/domains/social/invariants.md')).toContain('Business invariants belong in the database')
    expect(readDoc('docs/domains/social/lifecycle.md')).toContain('pending')
    expect(readDoc('docs/domains/social/events.md')).toContain('Event Generation Rules')
    expect(readDoc('docs/domains/social/anti-patterns.md')).toContain('Never derive follow state from `social_events`')
    expect(readDoc('docs/domains/social/architecture-principles.md')).toContain('Alerts are eventually consistent')
  })
})
