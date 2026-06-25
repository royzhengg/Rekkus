/**
 * Contract tests for the MFA recovery codes subsystem (ADR-0029).
 *
 * These are static analysis tests — they verify architectural invariants in source
 * files without a live database. They prevent common drift patterns identified during
 * design review.
 *
 * Invariants verified:
 *   1. Migration has explicit deny-all RLS policies on all four operations
 *   2. Migration RPCs use SECURITY DEFINER with SET search_path = public
 *   3. Migration enforces exactly-8-codes constraint in generate RPC
 *   4. Service RECOVERY_CODE_ALPHABET is exactly the spec value (immutable after release)
 *   5. Service client code never queries user_mfa_recovery_codes table directly
 *   6. isMFARequired() is defined only in the MFA service, not in UI components
 *   7. setMfaRequired is never called with SecureStore or AsyncStorage (no persisted override)
 *   8. Analytics events do not accept OTP/code/secret/qr parameters by name
 *   9. AuthContext exports authBootstrapping and mfaRequired
 *  10. Audit event type list in auth.ts matches migration CHECK constraint values
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const root = path.resolve(__dirname, '../../../')

function readSource(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), 'utf8')
}

function filesUnder(dir: string, ...exts: string[]): string[] {
  const results: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (exts.some(ext => entry.name.endsWith(ext))) results.push(full)
    }
  }
  walk(path.resolve(root, dir))
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Migration — explicit deny-all RLS
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA migration: RLS policies', () => {
  const migration = readSource('supabase/migrations/20260626000010_mfa_recovery_codes.sql')

  it('has deny_select policy', () => {
    expect(migration).toContain("deny_select")
    expect(migration).toContain('FOR SELECT')
    expect(migration).toContain('USING (false)')
  })

  it('has deny_insert policy', () => {
    expect(migration).toContain("deny_insert")
    expect(migration).toContain('FOR INSERT')
    expect(migration).toContain('WITH CHECK (false)')
  })

  it('has deny_update policy', () => {
    expect(migration).toContain("deny_update")
    expect(migration).toContain('FOR UPDATE')
  })

  it('has deny_delete policy', () => {
    expect(migration).toContain("deny_delete")
    expect(migration).toContain('FOR DELETE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Migration — SECURITY DEFINER + search_path hardening
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA migration: RPC security', () => {
  const migration = readSource('supabase/migrations/20260626000010_mfa_recovery_codes.sql')

  it('all functions have SECURITY DEFINER', () => {
    // Count occurrences: should have one per function (3 functions)
    const count = (migration.match(/SECURITY DEFINER/gi) ?? []).length
    expect(count).toBeGreaterThanOrEqual(3)
  })

  it('all functions set search_path = public', () => {
    const count = (migration.match(/SET search_path = public/gi) ?? []).length
    expect(count).toBeGreaterThanOrEqual(3)
  })

  it('generate_recovery_codes rejects non-8-code arrays', () => {
    expect(migration).toContain("array_length(p_codes, 1) != 8")
    expect(migration).toContain("exactly 8 recovery codes required")
  })

  it('generate_recovery_codes uses shared generation_id variable', () => {
    expect(migration).toContain('v_generation_id uuid := gen_random_uuid()')
    expect(migration).toContain('v_generation_id,')
  })

  it('verify_recovery_code checks auth.uid() is not null', () => {
    const verifyFn = migration.slice(migration.indexOf('verify_recovery_code'))
    expect(verifyFn).toMatch(/auth\.uid\(\) IS NULL/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. MFA service — RECOVERY_CODE_ALPHABET is immutable spec value
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA service: recovery code alphabet', () => {
  const service = readSource('lib/services/auth/mfa.ts')
  const EXPECTED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

  it('exports RECOVERY_CODE_ALPHABET constant', () => {
    expect(service).toContain('RECOVERY_CODE_ALPHABET')
  })

  it('alphabet equals the exact spec value (immutable after release)', () => {
    expect(service).toContain(`'${EXPECTED_ALPHABET}'`)
  })

  it('alphabet is exactly 31 characters (23 unambiguous letters + 8 digits 2–9)', () => {
    // 23 letters (A–Z minus I, L, O) + 8 digits (2–9) = 31 unique symbols.
    // The plan doc said "32" in error; this test is the authoritative count.
    expect(EXPECTED_ALPHABET.length).toBe(31)
  })

  it('alphabet excludes ambiguous characters I, L, O, 1, 0', () => {
    expect(EXPECTED_ALPHABET).not.toContain('I')
    expect(EXPECTED_ALPHABET).not.toContain('L')
    expect(EXPECTED_ALPHABET).not.toContain('O')
    expect(EXPECTED_ALPHABET).not.toContain('1')
    expect(EXPECTED_ALPHABET).not.toContain('0')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. No direct table queries to user_mfa_recovery_codes from client code
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA: no direct table access from client', () => {
  const clientFiles = [
    ...filesUnder('features', '.tsx', '.ts'),
    ...filesUnder('lib', '.ts'),
    ...filesUnder('app', '.tsx', '.ts'),
  ].filter(f =>
    !f.includes('mfa.ts') &&
    !f.includes('node_modules') &&
    !f.includes('.test.')
  )

  it('no client file queries user_mfa_recovery_codes directly', () => {
    const violations = clientFiles.filter(f => {
      try {
        return fs.readFileSync(f, 'utf8').includes('user_mfa_recovery_codes')
      } catch { return false }
    })
    expect(violations).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. isMFARequired defined only in service layer, not in UI
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA: AAL semantics live in service layer only', () => {
  const uiFiles = [
    ...filesUnder('features', '.tsx', '.ts'),
    ...filesUnder('app', '.tsx', '.ts'),
  ]

  it('no UI file defines isMFARequired', () => {
    const violations = uiFiles.filter(f => {
      try {
        return fs.readFileSync(f, 'utf8').includes('function isMFARequired')
      } catch { return false }
    })
    expect(violations).toHaveLength(0)
  })

  it('MFA service exports isMFARequired', () => {
    const service = readSource('lib/services/auth/mfa.ts')
    expect(service).toContain('export function isMFARequired')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. setMfaRequired is never persisted to SecureStore or AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA: recovery-code session override is never persisted', () => {
  const allSourceFiles = [
    ...filesUnder('features', '.tsx', '.ts'),
    ...filesUnder('lib', '.ts'),
    ...filesUnder('app', '.tsx', '.ts'),
  ]

  it('no file stores mfaRequired in SecureStore', () => {
    // Check for the specific pattern: storing a value named "mfaRequired" via SecureStore.
    // MFAChallengeScreen uses SecureStore for lockout counters (not mfaRequired), so a
    // coexistence check would produce false positives — we check the pattern specifically.
    const mfaRequiredStoragePattern = /SecureStore\.setItem\s*\([^)]*mfaRequired/
    const violations = allSourceFiles.filter(f => {
      try {
        return mfaRequiredStoragePattern.test(fs.readFileSync(f, 'utf8'))
      } catch { return false }
    })
    expect(violations).toHaveLength(0)
  })

  it('no file stores mfaRequired in AsyncStorage', () => {
    const violations = allSourceFiles.filter(f => {
      try {
        const src = fs.readFileSync(f, 'utf8')
        return src.includes('mfaRequired') && src.includes('AsyncStorage')
      } catch { return false }
    })
    expect(violations).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. AuthContext exports authBootstrapping and mfaRequired
// ─────────────────────────────────────────────────────────────────────────────
describe('AuthContext: MFA fields present', () => {
  const authContext = readSource('lib/contexts/AuthContext.tsx')

  it('exports authBootstrapping', () => {
    expect(authContext).toContain('authBootstrapping')
  })

  it('exports mfaRequired', () => {
    expect(authContext).toContain('mfaRequired')
  })

  it('exports setMfaRequired', () => {
    expect(authContext).toContain('setMfaRequired')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Analytics privacy: MFA event functions do not accept secret-sounding params
// ─────────────────────────────────────────────────────────────────────────────
describe('Analytics: MFA events do not accept credential parameters', () => {
  const analyticsFile = readSource('lib/analytics/events.ts')

  // Extract only the twoFactor section of the file
  const mfaSection = analyticsFile.slice(analyticsFile.indexOf('// MFA events'))

  it('twoFactor analytics accept no parameters named code, otp, secret, or qr', () => {
    // Check that function signatures don't accept credential-named params
    const credentialParamPattern = /twoFactor\w+.*\(.*\b(code|otp|secret|qr|token)\b.*\)/
    expect(credentialParamPattern.test(mfaSection)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Audit event types in service match migration CHECK constraint
// ─────────────────────────────────────────────────────────────────────────────
describe('Audit event types: service matches migration', () => {
  const authService = readSource('lib/services/auth.ts')
  const migration = readSource('supabase/migrations/20260626000010_mfa_recovery_codes.sql')

  const MFA_EVENT_TYPES = [
    'mfa_enrolled',
    'mfa_enroll_failed',
    'mfa_unenrolled',
    'mfa_challenge_started',
    'mfa_verified',
    'mfa_challenge_failed',
    'mfa_recovery_code_used',
    'mfa_recovery_code_failed',
    'mfa_recovery_codes_regenerated',
    'mfa_disable_attempted',
    'mfa_disable_cancelled',
  ]

  for (const eventType of MFA_EVENT_TYPES) {
    it(`'${eventType}' exists in both service and migration`, () => {
      expect(authService).toContain(`'${eventType}'`)
      expect(migration).toContain(`'${eventType}'`)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. No profiles.mfa_enabled column — MFA state is always derived
// ─────────────────────────────────────────────────────────────────────────────
describe('MFA state is derived, never stored', () => {
  const allFiles = [
    ...filesUnder('supabase/migrations', '.sql'),
    ...filesUnder('lib', '.ts'),
    ...filesUnder('features', '.tsx', '.ts'),
  ]

  it('no file references profiles.mfa_enabled', () => {
    const violations = allFiles.filter(f => {
      try {
        return fs.readFileSync(f, 'utf8').includes('mfa_enabled')
      } catch { return false }
    })
    expect(violations).toHaveLength(0)
  })
})
