import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import {
  fetchBlockedAccounts,
  unblockUser,
  type BlockedAccount,
} from '@/lib/services/moderation'

const STALE_AFTER_MS = 90 * 1000

function matchesSearch(account: BlockedAccount, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    account.username?.toLowerCase().includes(normalized) === true ||
    account.fullName?.toLowerCase().includes(normalized) === true
  )
}

export function useBlockedAccounts() {
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQueryState] = useState('')
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(() => new Set())
  const lastLoadedAtRef = useRef<number>(0)
  const searchTrackedRef = useRef(false)
  const unblockingIdsRef = useRef<Set<string>>(new Set())

  const load = useCallback(async (isRefresh = false) => {
    if (!user) {
      setBlockedAccounts([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const rows = await fetchBlockedAccounts(user.id)
      setBlockedAccounts(rows)
      lastLoadedAtRef.current = Date.now()
    } catch {
      setError('Blocked accounts could not be loaded right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  const refresh = useCallback(async () => {
    await load(true)
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastLoadedAtRef.current > STALE_AFTER_MS) void load()
  }, [load])

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query)
    if (!searchTrackedRef.current && query.trim()) {
      searchTrackedRef.current = true
      analytics.blockedAccountsSearchUsed(user?.id ?? null)
    }
  }, [user?.id])

  const unblock = useCallback(async (account: BlockedAccount): Promise<boolean> => {
    if (!user || unblockingIdsRef.current.has(account.blockedUserId)) return false
    if (!requireOnline()) {
      setError('Reconnect to unblock this account.')
      return false
    }
    const previousAccounts = blockedAccounts
    setError(null)
    unblockingIdsRef.current = new Set(unblockingIdsRef.current).add(account.blockedUserId)
    setUnblockingIds(previous => new Set(previous).add(account.blockedUserId))
    setBlockedAccounts(previous => previous.filter(row => row.blockedUserId !== account.blockedUserId))
    try {
      const failure = await unblockUser(user.id, account.blockedUserId)
      if (failure) {
        setBlockedAccounts(previousAccounts)
        setError(failure)
        return false
      }
      return true
    } catch (reason: unknown) {
      setBlockedAccounts(previousAccounts)
      setError(reason instanceof Error ? reason.message : 'This account could not be unblocked.')
      return false
    } finally {
      const nextIds = new Set(unblockingIdsRef.current)
      nextIds.delete(account.blockedUserId)
      unblockingIdsRef.current = nextIds
      setUnblockingIds(previous => {
        const next = new Set(previous)
        next.delete(account.blockedUserId)
        return next
      })
    }
  }, [blockedAccounts, requireOnline, user])

  const trimmedSearchQuery = searchQuery.trim()
  const filteredAccounts = useMemo(
    () => blockedAccounts.filter(account => matchesSearch(account, trimmedSearchQuery)),
    [blockedAccounts, trimmedSearchQuery]
  )

  return {
    blockedAccounts,
    count: blockedAccounts.length,
    error,
    filteredAccounts,
    loading,
    refresh,
    refreshing,
    refreshIfStale,
    searchQuery,
    setSearchQuery,
    trimmedSearchQuery,
    unblock,
    unblockingIds,
  }
}
