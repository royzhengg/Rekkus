import React, { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { AuthPromptModal } from '@/components/AuthPromptModal'

interface AuthGateContextValue {
  requireAuth: (onSuccess?: () => void) => void
}

const AuthGateContext = createContext<AuthGateContextValue>({
  requireAuth: () => {},
})

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
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
      <AuthPromptModal visible={visible} onDismiss={handleDismiss} />
    </AuthGateContext.Provider>
  )
}

export function useAuthGate() {
  return useContext(AuthGateContext)
}
