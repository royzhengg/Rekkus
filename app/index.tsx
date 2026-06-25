import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/contexts/AuthContext'

// Boot gate: waits for AAL check before deciding destination.
// mfaRequired → challenge screen before any authenticated route.
// This is not the only MFA gate — MFAGate in _layout.tsx intercepts deep links too.
export default function Index() {
  const { authBootstrapping, session, mfaRequired } = useAuth()

  if (authBootstrapping) return null

  if (!session) return <Redirect href="/(auth)/login" />
  if (mfaRequired) return <Redirect href="/(auth)/mfa-challenge" />
  return <Redirect href="/(tabs)/feed" />
}
