// useMFA — owns all MFA state and mutations. AuthContext stays lean (session/user/mfaRequired only).
// All factor enumeration, challenge issuance, recovery code operations live here.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/contexts/AuthContext'
import {
  challengeFactor,
  countRemainingRecoveryCodes,
  enrollTOTP,
  generateAndStoreRecoveryCodes,
  listFactors,
  unenrollFactor,
  verifyFactor,
  verifyRecoveryCode as verifyRecoveryCodeRPC,
  type EnrollTOTPResult,
  type MFAFactor,
} from '@/lib/services/auth/mfa'

export interface UseMFAReturn {
  factors: MFAFactor[]
  verifiedFactors: MFAFactor[]
  mfaEnabled: boolean                    // derived: verifiedFactors.length > 0; never manually set
  remainingRecoveryCodes: number
  loading: boolean

  // Enrollment
  beginEnrollment: () => Promise<EnrollTOTPResult | { error: string }>
  issueChallenge: (factorId: string) => Promise<{ challengeId: string } | { error: string }>
  confirmEnrollment: (factorId: string, challengeId: string, code: string) => Promise<string | null>
  generateRecoveryCodes: () => Promise<string[] | { error: string }>

  // Challenge (post-login)
  verifyChallenge: (factorId: string, challengeId: string, code: string) => Promise<string | null>
  verifyRecoveryCode: (code: string) => Promise<boolean>

  // Management
  disableMFA: (factorId: string) => Promise<string | null>
  refreshFactors: () => Promise<void>
}

export function useMFA(): UseMFAReturn {
  const { session } = useAuth()
  const [factors, setFactors] = useState<MFAFactor[]>([])
  const [remainingRecoveryCodes, setRemainingRecoveryCodes] = useState(0)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refreshFactors = useCallback(async () => {
    if (!session) {
      setFactors([])
      setRemainingRecoveryCodes(0)
      setLoading(false)
      return
    }
    try {
      const [fresh, remaining] = await Promise.all([
        listFactors(),
        countRemainingRecoveryCodes().catch(() => 0),
      ])
      if (!mountedRef.current) return
      setFactors(fresh)
      setRemainingRecoveryCodes(remaining)
    } catch {
      // Non-fatal: leave existing state
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void refreshFactors()
  }, [refreshFactors])

  const verifiedFactors = factors.filter(f => f.status === 'verified')
  const mfaEnabled = verifiedFactors.length > 0

  // ----------------------------------------------------------------
  // Enrollment
  // ----------------------------------------------------------------

  const beginEnrollment = useCallback(async (): Promise<EnrollTOTPResult | { error: string }> => {
    // Block if already enrolled
    const current = await listFactors().catch(() => [] as MFAFactor[])
    const alreadyVerified = current.filter(f => f.status === 'verified')
    if (alreadyVerified.length > 0) {
      return { error: 'An authenticator is already set up.' }
    }
    // Clean up stale unverified factors (>1 hour old) before enrolling.
    // Only do this if Supabase does NOT auto-expire them (verify in spike; remove if redundant).
    const stale = current.filter(f => {
      if (f.status === 'verified') return false
      const createdAt = new Date((f as MFAFactor & { created_at?: string }).created_at ?? 0).getTime()
      return Date.now() - createdAt > 60 * 60 * 1000
    })
    await Promise.allSettled(stale.map(f => unenrollFactor(f.id)))

    return enrollTOTP()
  }, [])

  const issueChallenge = useCallback(
    async (factorId: string): Promise<{ challengeId: string } | { error: string }> => {
      return challengeFactor(factorId)
    },
    []
  )

  const confirmEnrollment = useCallback(
    async (factorId: string, challengeId: string, code: string): Promise<string | null> => {
      const error = await verifyFactor(factorId, challengeId, code)
      if (!error) await refreshFactors()
      return error
    },
    [refreshFactors]
  )

  const generateRecoveryCodes = useCallback(async (): Promise<string[] | { error: string }> => {
    try {
      const codes = await generateAndStoreRecoveryCodes()
      if (mountedRef.current) setRemainingRecoveryCodes(codes.length)
      return codes
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Could not generate recovery codes.' }
    }
  }, [])

  // ----------------------------------------------------------------
  // Challenge (post-login)
  // ----------------------------------------------------------------

  const verifyChallenge = useCallback(
    async (factorId: string, challengeId: string, code: string): Promise<string | null> => {
      return verifyFactor(factorId, challengeId, code)
    },
    []
  )

  const verifyRecoveryCode = useCallback(async (code: string): Promise<boolean> => {
    const ok = await verifyRecoveryCodeRPC(code)
    if (ok && mountedRef.current) {
      setRemainingRecoveryCodes(prev => Math.max(0, prev - 1))
    }
    return ok
  }, [])

  // ----------------------------------------------------------------
  // Management
  // ----------------------------------------------------------------

  const disableMFA = useCallback(async (factorId: string): Promise<string | null> => {
    const error = await unenrollFactor(factorId)
    if (!error) await refreshFactors()
    return error
  }, [refreshFactors])

  return {
    factors,
    verifiedFactors,
    mfaEnabled,
    remainingRecoveryCodes,
    loading,
    beginEnrollment,
    issueChallenge,
    confirmEnrollment,
    generateRecoveryCodes,
    verifyChallenge,
    verifyRecoveryCode,
    disableMFA,
    refreshFactors,
  }
}
