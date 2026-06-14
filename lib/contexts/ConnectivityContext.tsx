import * as Network from 'expo-network'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { getSession } from '@/lib/services/auth'
import {
  clearDeferredMutationsForUser,
  deferredMutationDomain,
  enqueueDeferredMutation,
  executeDeferredMutation,
  incrementRetryCount,
  isRetryableDeferredMutationError,
  MAX_RETRY_COUNT,
  readDeferredMutations,
  removeDeferredMutation,
  type DeferredMutation,
  type DeferredMutationInput,
} from '@/lib/services/deferredMutations'

export type ConnectivityState = 'checking' | 'online' | 'offline' | 'degraded'
export type ConnectivitySyncState = 'idle' | 'syncing' | 'synced' | 'failed'

type DeferredResult = { queued: boolean }

type ConnectivityValue = {
  state: ConnectivityState
  pendingCount: number
  isSyncing: boolean
  syncState: ConnectivitySyncState
  syncEpoch: number
  runDeferredMutation: (input: DeferredMutationInput) => Promise<DeferredResult>
  requireOnline: () => boolean
  registerSyncListener: (cb: () => void) => () => void
}

const ConnectivityContext = createContext<ConnectivityValue>({
  state: 'checking',
  pendingCount: 0,
  isSyncing: false,
  syncState: 'idle',
  syncEpoch: 0,
  runDeferredMutation: async () => ({ queued: false }),
  requireOnline: () => true,
  registerSyncListener: () => () => {},
})

function mapNetworkState(networkState: Network.NetworkState): ConnectivityState {
  if (networkState.isConnected === false || networkState.isInternetReachable === false) return 'offline'
  if (networkState.isConnected === true) return 'online'
  return 'checking'
}

function withIdentity(input: DeferredMutationInput, userId: string): DeferredMutation {
  const updatedAt = new Date().toISOString()
  const retryCount = 0
  switch (input.kind) {
    case 'post_save': return { ...input, userId, updatedAt, retryCount }
    case 'dish_save': return { ...input, userId, updatedAt, retryCount }
    case 'place_save': return { ...input, userId, updatedAt, retryCount }
    case 'follow': return { ...input, userId, updatedAt, retryCount }
    case 'post_like': return { ...input, userId, updatedAt, retryCount }
    case 'setting': return { ...input, userId, updatedAt, retryCount }
    case 'message_reaction': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_mute': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_unmute': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_archive': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_unarchive': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_pin': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_unpin': return { ...input, userId, updatedAt, retryCount }
    case 'conversation_unread': return { ...input, userId, updatedAt, retryCount }
  }
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<ConnectivityState>('checking')
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState, setSyncState] = useState<ConnectivitySyncState>('idle')
  const [syncEpoch, setSyncEpoch] = useState(0)
  const flushingRef = useRef(false)
  const previousUserIdRef = useRef<string | null>(null)
  const syncListenersRef = useRef<Set<() => void>>(new Set())

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(user ? (await readDeferredMutations(user.id)).length : 0)
  }, [user])

  const flush = useCallback(async () => {
    if (!user || state !== 'online' || flushingRef.current) return
    flushingRef.current = true
    try {
      const session = await getSession()
      if (!session) return  // session expired — do not replay
      const pending = await readDeferredMutations(user.id)
      if (pending.length === 0) {
        setPendingCount(0)
        return
      }
      setSyncState('syncing')
      let failed = false
      let consecutiveRetryable = 0
      for (const mutation of pending) {
        // Guard: skip mutations that belong to a different user (mid-flush user change)
        if (mutation.userId !== user.id) continue
        try {
          await executeDeferredMutation(mutation)
          await removeDeferredMutation(mutation)
          analytics.offlineMutation(user.id, deferredMutationDomain(mutation), 'synced')
          consecutiveRetryable = 0
        } catch (reason: unknown) {
          failed = true
          analytics.offlineMutation(user.id, deferredMutationDomain(mutation), 'sync_failed')
          if (isRetryableDeferredMutationError(reason)) {
            consecutiveRetryable++
            const updated = incrementRetryCount(mutation)
            if (updated.retryCount >= MAX_RETRY_COUNT) {
              // Exceeded retry cap — treat as permanent failure
              await removeDeferredMutation(mutation)
              analytics.offlineMutation(user.id, deferredMutationDomain(mutation), 'sync_failed')
            } else {
              await enqueueDeferredMutation(updated)
              if (consecutiveRetryable >= 3) {
                // Backend appears unreachable — mark degraded and abort
                setState('degraded')
                break
              }
            }
          } else {
            await removeDeferredMutation(mutation)
          }
        }
      }
      await refreshPendingCount()
      setSyncState(failed ? 'failed' : 'synced')
      setSyncEpoch(e => e + 1)
    } finally {
      flushingRef.current = false
    }
  }, [refreshPendingCount, state, user])

  useEffect(() => {
    void Network.getNetworkStateAsync().then(next => setState(mapNetworkState(next))).catch(() => setState('checking'))
    const subscription = Network.addNetworkStateListener(next => {
      const next2 = mapNetworkState(next)
      setState(next2)
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = user?.id ?? null
    if (previousUserId && previousUserId !== nextUserId) {
      void clearDeferredMutationsForUser(previousUserId)
    }
    previousUserIdRef.current = nextUserId
    void refreshPendingCount()
  }, [refreshPendingCount, user?.id])

  useEffect(() => {
    if (state === 'online') void flush()
  }, [flush, state])

  useEffect(() => {
    if (syncState !== 'synced') return
    const timer = setTimeout(() => setSyncState('idle'), 3000)
    return () => clearTimeout(timer)
  }, [syncState])

  const runDeferredMutation = useCallback(async (input: DeferredMutationInput): Promise<DeferredResult> => {
    if (!user) throw new Error('Authentication required.')
    const mutation = withIdentity(input, user.id)
    if (state === 'offline' || state === 'degraded') {
      await enqueueDeferredMutation(mutation)
      await refreshPendingCount()
      analytics.offlineMutation(user.id, deferredMutationDomain(mutation), 'queued')
      return { queued: true }
    }
    try {
      await executeDeferredMutation(mutation)
      return { queued: false }
    } catch (reason: unknown) {
      if (!isRetryableDeferredMutationError(reason)) throw reason
      await enqueueDeferredMutation(mutation)
      await refreshPendingCount()
      analytics.offlineMutation(user.id, deferredMutationDomain(mutation), 'queued')
      return { queued: true }
    }
  }, [refreshPendingCount, state, user])

  useEffect(() => {
    if (syncEpoch === 0) return
    syncListenersRef.current.forEach(cb => cb())
  }, [syncEpoch])

  const registerSyncListener = useCallback((cb: () => void) => {
    syncListenersRef.current.add(cb)
    return () => { syncListenersRef.current.delete(cb) }
  }, [])

  const value = useMemo<ConnectivityValue>(() => ({
    state,
    pendingCount,
    isSyncing: syncState === 'syncing',
    syncState,
    syncEpoch,
    runDeferredMutation,
    requireOnline: () => state !== 'offline',
    registerSyncListener,
  }), [pendingCount, registerSyncListener, runDeferredMutation, state, syncEpoch, syncState])

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext)
}
