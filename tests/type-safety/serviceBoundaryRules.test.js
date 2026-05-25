const assert = require('node:assert/strict')
const test = require('node:test')
const { serviceBoundaryFailures } = require('../../scripts/lib/service-boundary-rules')

test('service-boundary scanner rejects direct imports in hooks and contexts', () => {
  assert.equal(
    serviceBoundaryFailures('lib/hooks/useUnsafe.ts', "import { supabase } from '../supabase'").length,
    1
  )
  assert.equal(
    serviceBoundaryFailures('lib/contexts/AuthContext.tsx', "import type { User } from '@supabase/supabase-js'").length,
    1
  )
})

test('service-boundary scanner permits service-owned provider access', () => {
  assert.deepEqual(
    serviceBoundaryFailures('lib/services/auth.ts', "import { supabase } from '@/lib/supabase'"),
    []
  )
})

test('service-boundary scanner rejects obsolete allowlist entries', () => {
  assert.equal(
    serviceBoundaryFailures('features/profile/ProfileScreen.tsx', "import { fetchProfile } from '@/lib/services/users'", true).length,
    1
  )
})
