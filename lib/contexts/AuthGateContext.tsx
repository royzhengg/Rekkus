import { useRouter } from 'expo-router'
import React, { createContext, useContext, useState, useCallback } from 'react'
import { AuthPromptModal } from '@/components/AuthPromptModal'
import { useAuth } from './AuthContext'

interface AuthGateContextValue {
  requireAuth: (onSuccess?: () => void) => void
}

const AuthGateContext = createContext<AuthGateContextValue>({
  requireAuth: () => {},
})

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [_pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)

  const requireAuth = useCallback(
    (onSuccess?: () => void) => {
      if (user) {
        onSuccess?.()
      } else {
        setPendingCallback(() => onSuccess ?? null)
        setVisible(true)
      }
    },
    [user]
  )

  function handleDismiss() {
    setVisible(false)
    setPendingCallback(null)
  }

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <AuthPromptModal
        visible={visible}
        onDismiss={handleDismiss}
        onCreateAccount={() => router.push('/(auth)/welcome')}
        onSignIn={() => router.push('/(auth)/login')}
      />
    </AuthGateContext.Provider>
  )
}

export function useAuthGate() {
  return useContext(AuthGateContext)
}
