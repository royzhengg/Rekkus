#!/usr/bin/env node
// Creates a test user in Supabase. Run with: node scripts/create-test-user.js
// IMPORTANT: Run against LOCAL Supabase only (supabase start) — never the live project.
//   Local: http://127.0.0.1:54321 | Auth emails captured at http://localhost:54324 (Inbucket)
// If sign-in fails with "Email not confirmed", disable email confirmation in the Supabase dashboard:
//   Authentication → Providers → Email → uncheck "Confirm email", then re-run.

console.warn(
  '[create-test-user] Run against local Supabase (supabase start) — never the live project.\n'
)

// Set SUPABASE_URL and SUPABASE_ANON_KEY to your local instance values from `supabase start`
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
if (!SUPABASE_ANON_KEY) {
  console.error('Set SUPABASE_ANON_KEY to the anon key printed by `supabase start`')
  process.exit(1)
}

const TEST_EMAIL = 'testuser@test.invalid'
const TEST_PASSWORD = 'Test1234!'
const TEST_USERNAME = 'testuser'
const TEST_DISPLAY_NAME = 'Test User'

async function main() {
  // Step 1: Try sign-in first (user may already exist)
  console.log(`Signing in as: ${TEST_EMAIL}`)
  let signinData = await signIn()

  if (!signinData) {
    // Step 2: Sign up if sign-in failed with user not found
    console.log('User not found — creating account...')
    await signUp()
    signinData = await signIn()
  }

  if (!signinData) process.exit(1)

  const { access_token, user } = signinData
  console.log(`Authenticated as: ${user.id}`)

  // Step 3: Upsert profile row
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: user.id,
      username: TEST_USERNAME,
      full_name: TEST_DISPLAY_NAME,
      bio: 'I am a test user',
      avatar_url: null,
      updated_at: new Date().toISOString(),
    }),
  })

  if (!profileRes.ok) {
    const err = await profileRes.json()
    console.error('Profile upsert failed:', err)
    process.exit(1)
  }

  console.log('\n✓ Test user ready')
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log(`  Username: @${TEST_USERNAME}`)
}

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) {
    if (data.error_code === 'email_not_confirmed') {
      console.error('\nEmail confirmation is still enabled.')
      console.error('Disable it in the Supabase dashboard:')
      console.error(
        '  1. Open: https://supabase.com/dashboard/project/scwvlqwolfduaalbemzz/auth/providers'
      )
      console.error('  2. Under "Email", uncheck "Confirm email"')
      console.error('  3. Re-run: node scripts/create-test-user.js')
      process.exit(1)
    }
    if (data.error_code === 'invalid_credentials') return null // user doesn't exist yet
    console.error('Sign in failed:', data)
    process.exit(1)
  }
  return data
}

async function signUp() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('Signup failed:', data)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
