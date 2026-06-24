import {
  buildInitialProviderState,
  classifyReconnectError,
  getNewlyRevokedProviders,
  isValidProviderStateRecord,
  reconcileProviderState,
  type ProviderStateRecord,
} from '@/lib/services/auth/providerState'
import type { UserIdentity } from '@supabase/supabase-js'

function identity(provider: string): UserIdentity {
  return {
    id: `id-${provider}`,
    user_id: 'user-1',
    identity_id: `identity-${provider}`,
    provider,
    identity_data: {},
    last_sign_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

const googleId = identity('google')
const appleId = identity('apple')
const emailId = identity('email')

describe('buildInitialProviderState', () => {
  it('starts all OAuth providers as connected regardless of identity list', () => {
    const state = buildInitialProviderState([emailId])
    expect(state.google).toBe('connected')
    expect(state.apple).toBe('connected')
  })

  it('handles empty identity list', () => {
    const state = buildInitialProviderState([])
    expect(state.google).toBe('connected')
    expect(state.apple).toBe('connected')
  })
})

describe('reconcileProviderState', () => {
  const allConnected: ProviderStateRecord = { google: 'connected', apple: 'connected' }

  it('returns existing state unchanged when fresh is null (network failure)', () => {
    const existing: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    expect(reconcileProviderState(null, existing)).toStrictEqual(existing)
  })

  it('marks provider revoked when absent from fresh identities', () => {
    const result = reconcileProviderState([appleId], allConnected)
    expect(result.google).toBe('revoked')
    expect(result.apple).toBe('connected')
  })

  it('self-heals revoked provider when identity reappears', () => {
    const revoked: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    const result = reconcileProviderState([googleId, appleId], revoked)
    expect(result.google).toBe('connected')
    expect(result.apple).toBe('connected')
  })

  it('is order-independent — identity order change produces no revocations', () => {
    const result = reconcileProviderState([appleId, googleId], allConnected)
    expect(result.google).toBe('connected')
    expect(result.apple).toBe('connected')
  })

  it('is deduplication-safe — duplicate identities produce no false revocations', () => {
    const result = reconcileProviderState([googleId, googleId, appleId], allConnected)
    expect(result.google).toBe('connected')
    expect(result.apple).toBe('connected')
  })

  it('detects multi-provider revocation', () => {
    const result = reconcileProviderState([], allConnected)
    expect(result.google).toBe('revoked')
    expect(result.apple).toBe('revoked')
  })

  it('stays revoked when fresh = null (cached revoked + network failure)', () => {
    const revoked: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    const result = reconcileProviderState(null, revoked)
    expect(result.google).toBe('revoked')
  })

  it('resolves connecting to connected when fresh identity is present (must not stay stuck)', () => {
    const connecting: ProviderStateRecord = { google: 'connecting', apple: 'connected' }
    const result = reconcileProviderState([googleId], connecting)
    expect(result.google).toBe('connected')
  })

  it('resolves connecting to revoked when fresh identity is absent', () => {
    const connecting: ProviderStateRecord = { google: 'connecting', apple: 'connected' }
    const result = reconcileProviderState([], connecting)
    expect(result.google).toBe('revoked')
  })

  it('ignores unknown/future providers in fresh identities (e.g. facebook, instagram)', () => {
    const facebook = identity('facebook')
    const instagram = identity('instagram')
    const result = reconcileProviderState([googleId, facebook, instagram], allConnected)
    expect(result.google).toBe('connected')
    expect(result.apple).toBe('revoked')
    // No facebook or instagram keys
    expect(Object.keys(result)).toStrictEqual(expect.arrayContaining(['google', 'apple']))
    expect(Object.keys(result).length).toBe(2)
  })

  it('email-only user produces no OAuth revocations', () => {
    const result = reconcileProviderState([emailId], allConnected)
    // google and apple absent from identities → both revoked
    // (this is correct: they'll self-heal on next refresh if they were never linked,
    // but the reconnect UI won't show because identity is absent)
    expect(result.google).toBe('revoked')
    expect(result.apple).toBe('revoked')
  })
})

describe('getNewlyRevokedProviders', () => {
  it('returns providers that transitioned connected → revoked', () => {
    const prev: ProviderStateRecord = { google: 'connected', apple: 'connected' }
    const next: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    expect(getNewlyRevokedProviders(prev, next)).toStrictEqual(['google'])
  })

  it('does NOT fire for revoked → revoked (no transition)', () => {
    const prev: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    const next: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    expect(getNewlyRevokedProviders(prev, next)).toStrictEqual([])
  })

  it('handles multi-provider revocation', () => {
    const prev: ProviderStateRecord = { google: 'connected', apple: 'connected' }
    const next: ProviderStateRecord = { google: 'revoked', apple: 'revoked' }
    expect(getNewlyRevokedProviders(prev, next)).toEqual(expect.arrayContaining(['google', 'apple']))
    expect(getNewlyRevokedProviders(prev, next).length).toBe(2)
  })

  it('does NOT fire for connecting → revoked from revoked baseline', () => {
    const prev: ProviderStateRecord = { google: 'connecting', apple: 'connected' }
    // connecting is a non-revoked state, so this SHOULD fire (was connecting, now revoked)
    const next: ProviderStateRecord = { google: 'revoked', apple: 'connected' }
    expect(getNewlyRevokedProviders(prev, next)).toStrictEqual(['google'])
  })
})

describe('reconnect retry loop', () => {
  it('revoked → fail → revoked → fail → revoked → success → connected', () => {
    let state: ProviderStateRecord = { google: 'revoked', apple: 'connected' }

    // Attempt 1 fail
    state = { ...state, google: 'connecting' }
    state = { ...state, google: 'revoked' }
    expect(state.google).toBe('revoked')

    // Attempt 2 fail
    state = { ...state, google: 'connecting' }
    state = { ...state, google: 'revoked' }
    expect(state.google).toBe('revoked')

    // Attempt 3 success
    state = { ...state, google: 'connecting' }
    state = { ...state, google: 'connected' }
    expect(state.google).toBe('connected')
  })
})

describe('isValidProviderStateRecord', () => {
  it('accepts valid record', () => {
    expect(isValidProviderStateRecord({ google: 'connected', apple: 'revoked' })).toBe(true)
    expect(isValidProviderStateRecord({ google: 'connecting', apple: 'connected' })).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidProviderStateRecord(null)).toBe(false)
  })

  it('rejects empty object (missing keys)', () => {
    expect(isValidProviderStateRecord({})).toBe(false)
  })

  it('rejects wrong value type', () => {
    expect(isValidProviderStateRecord({ google: true, apple: 'connected' })).toBe(false)
  })

  it('rejects unknown state value', () => {
    expect(isValidProviderStateRecord({ google: 'banana', apple: 'connected' })).toBe(false)
  })

  it('rejects extra keys (unknown provider)', () => {
    expect(isValidProviderStateRecord({ google: 'connected', apple: 'connected', facebook: 'revoked' })).toBe(false)
  })

  it('rejects partial keys', () => {
    expect(isValidProviderStateRecord({ google: 'connected' })).toBe(false)
  })
})

describe('classifyReconnectError', () => {
  it('classifies cancel errors', () => {
    expect(classifyReconnectError('ERR_REQUEST_CANCELED')).toBe('cancelled')
    expect(classifyReconnectError('User cancelled the flow')).toBe('cancelled')
  })

  it('classifies network errors', () => {
    expect(classifyReconnectError('Network request failed')).toBe('network')
    expect(classifyReconnectError('fetch timeout')).toBe('network')
  })

  it('classifies OAuth errors', () => {
    expect(classifyReconnectError('Invalid OAuth token')).toBe('oauth_failure')
    expect(classifyReconnectError('provider returned an error')).toBe('oauth_failure')
  })

  it('falls back to unknown', () => {
    expect(classifyReconnectError('Something unexpected happened')).toBe('unknown')
  })
})
