// MFA service — wraps Supabase native MFA APIs and Rekkus recovery code RPCs.
// AAL semantics: isMFARequired() is the single source of truth. Never scatter this check in UI.
//
// Privacy invariant: never log, store, or pass OTP values, recovery codes, TOTP secrets,
// or QR SVG payloads to analytics or audit events. Factor IDs and event types only.

import * as Crypto from 'expo-crypto'
import { supabase } from '@/lib/supabase'
import type { Factor } from '@supabase/supabase-js'

export type MFAFactor = Factor

// Recovery code alphabet: standard Base32 with ambiguous characters removed.
// I, L, O, 1, 0 removed to prevent misreads (hand-typed codes).
// IMMUTABLE AFTER RELEASE — changing this invalidates all existing stored codes.
// If changed in a future version, a forced regeneration migration is required for all users.
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const RECOVERY_CODE_BYTES = 10 // 80-bit entropy per code
const RECOVERY_CODE_COUNT = 8

export interface EnrollTOTPResult {
  qrCode: string   // data-URI SVG from Supabase — render with <Image>; never log
  secret: string   // manual entry fallback; never log
  factorId: string
}

// ----------------------------------------------------------------
// AAL — Authenticator Assurance Level
// ----------------------------------------------------------------

export interface AssuranceLevel {
  currentLevel: 'aal1' | 'aal2'
  nextLevel: 'aal1' | 'aal2'
}

export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return {
    currentLevel: data.currentLevel as 'aal1' | 'aal2',
    nextLevel: data.nextLevel as 'aal1' | 'aal2',
  }
}

// True when the user has enrolled MFA but has not yet satisfied the MFA challenge
// for this session. All AAL logic must flow through this function.
export function isMFARequired(aal: AssuranceLevel): boolean {
  return aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1'
}

// ----------------------------------------------------------------
// Factor management
// ----------------------------------------------------------------

export async function listFactors(): Promise<MFAFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp ?? []
}

export async function enrollTOTP(friendlyName = 'Authenticator App'): Promise<EnrollTOTPResult | { error: string }> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })
  if (error) return { error: error.message }
  return {
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    factorId: data.id,
  }
}

export async function challengeFactor(factorId: string): Promise<{ challengeId: string } | { error: string }> {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId })
  if (error) return { error: error.message }
  return { challengeId: data.id }
}

// Returns null on success, error message on failure.
export async function verifyFactor(factorId: string, challengeId: string, code: string): Promise<string | null> {
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
  return error?.message ?? null
}

// Returns null on success, error message on failure.
export async function unenrollFactor(factorId: string): Promise<string | null> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return error?.message ?? null
}

// ----------------------------------------------------------------
// Recovery codes — user_id always derived from auth.uid() inside RPCs
// ----------------------------------------------------------------

// Custom Base32 encoding using RECOVERY_CODE_ALPHABET.
function encodeBase32(bytes: Uint8Array): string {
  const alphabet = RECOVERY_CODE_ALPHABET
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  // No padding — we always encode a fixed number of bytes
  return output
}

// Generate 8 recovery codes using CSPRNG.
// Each code: 10 random bytes → Base32 → 16 chars → displayed as XXXX-XXXX-XXXX-XXXX.
// Codes are persisted to DB before being returned. If persistence fails, throws
// so the caller can show a retry — codes are never displayed without being stored.
export async function generateAndStoreRecoveryCodes(): Promise<string[]> {
  const plainCodes: string[] = []

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = await Crypto.getRandomBytesAsync(RECOVERY_CODE_BYTES)
    const raw = encodeBase32(new Uint8Array(bytes))
    // Format: XXXX-XXXX-XXXX-XXXX (16 chars, 3 dashes)
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
    plainCodes.push(formatted)
  }

  // Persist BEFORE returning. If this fails, codes are not displayed.
  const { error } = await supabase.rpc('generate_recovery_codes', { p_codes: plainCodes })
  if (error) throw new Error(error.message)

  return plainCodes
}

// Client-side format validation before hitting the RPC.
// Returns true if the code matches the expected alphabet and length.
export function isValidRecoveryCodeFormat(code: string): boolean {
  // Allow with or without dashes/spaces
  const normalised = code.replace(/[\s-]/g, '').toUpperCase()
  if (normalised.length !== 16) return false
  const validChars = new RegExp(`^[${RECOVERY_CODE_ALPHABET}]+$`)
  return validChars.test(normalised)
}

// Returns true if the code was valid and unused, false otherwise.
// Validates format client-side before RPC to save a round-trip on garbage input.
export async function verifyRecoveryCode(code: string): Promise<boolean> {
  if (!isValidRecoveryCodeFormat(code)) return false
  const { data, error } = await supabase.rpc('verify_recovery_code', { p_code: code })
  if (error) return false
  return data === true
}

export async function countRemainingRecoveryCodes(): Promise<number> {
  const { data, error } = await supabase.rpc('count_remaining_recovery_codes')
  if (error) throw error
  return data as number
}
