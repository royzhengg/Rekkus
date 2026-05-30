import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { Toast } from '@/components/ui/Toast'

const DEFAULT_DURATION = 3000

type ToastState = {
  message: string
  title?: string
  type: 'success' | 'info'
}

type ToastOptions = {
  title?: string
  type?: 'success' | 'info'
  duration?: number
}

type ToastContextValue = {
  showToast: (message: string, opts?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  const showToast = useCallback((message: string, opts?: ToastOptions) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setToast({ message, ...(opts?.title !== undefined ? { title: opts.title } : {}), type: opts?.type ?? 'success' })
    setVisible(true)
    timerRef.current = setTimeout(() => {
      hide()
      timerRef.current = null
    }, opts?.duration ?? DEFAULT_DURATION)
  }, [hide])

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <Toast
            visible={visible}
            message={toast.message}
            {...(toast.title !== undefined ? { title: toast.title } : {})}
            type={toast.type}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
