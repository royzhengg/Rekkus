import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { SearchIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useBlockedAccounts } from '@/features/settings/hooks/useBlockedAccounts'
import { BackButton } from '@/features/settings/SettingsControlDock'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useToast } from '@/lib/contexts/ToastContext'
import type { BlockedAccount } from '@/lib/services/moderation'

const AVATAR_SIZE = spacing.px40 + spacing[1]
const ROW_MIN_HEIGHT = spacing.px60 + spacing[3]
const UNBLOCK_MIN_WIDTH = spacing.px60 + spacing[4]

function displayName(account: BlockedAccount): string {
  return account.fullName?.trim() || account.username || 'Deleted account'
}

function initials(account: BlockedAccount): string {
  const source = displayName(account)
  return source.slice(0, 2).toUpperCase()
}

function relativeBlockedDate(value: string): string {
  const date = new Date(value)
  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (absMs < month) return rtf.format(Math.round(diffMs / day), 'day')
  if (absMs < year) return rtf.format(Math.round(diffMs / month), 'month')
  return rtf.format(Math.round(diffMs / year), 'year')
}

function absoluteBlockedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

export default function BlockedAccountsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { showToast } = useToast()
  const [confirmAccount, setConfirmAccount] = useState<BlockedAccount | null>(null)
  const {
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
  } = useBlockedAccounts()

  useFocusEffect(
    useCallback(() => {
      analytics.blockedAccountsScreenViewed(user?.id ?? null)
      refreshIfStale()
    }, [refreshIfStale, user?.id])
  )

  async function confirmUnblock(account: BlockedAccount) {
    const success = await unblock(account)
    if (success) showToast('Account unblocked')
  }

  function renderSkeleton() {
    return (
      <View style={styles.skeletonList}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={styles.skeletonRow}>
            <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={radius.full} />
            <View style={styles.skeletonText}>
              <Skeleton width="58%" height={14} />
              <Skeleton width="36%" height={12} />
            </View>
          </View>
        ))}
      </View>
    )
  }

  function renderItem({ item }: { item: BlockedAccount }) {
    const name = displayName(item)
    const absoluteDate = absoluteBlockedDate(item.blockedAt)
    const pending = unblockingIds.has(item.blockedUserId)
    return (
      <View
        style={styles.row}
        accessibilityLabel={`${name}. ${item.username ? `@${item.username}. ` : ''}Blocked ${absoluteDate}.`}
      >
        <View style={styles.avatarWrap}>
          {item.avatarUrl ? (
            <CachedImage
              source={{ uri: item.avatarUrl }}
              style={styles.avatar}
              accessibilityLabel={`${name} profile photo`}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
                {initials(item)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {name}
          </Text>
          {item.username ? (
            <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              @{item.username}
            </Text>
          ) : null}
          <Text style={styles.meta} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            Blocked {relativeBlockedDate(item.blockedAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.unblockButton, pending && styles.unblockButtonDisabled]}
          onPress={() => setConfirmAccount(item)}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel={`Unblock ${name}`}
          accessibilityState={{ disabled: pending, busy: pending }}
        >
          {pending ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.unblockLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Unblock
            </Text>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  const empty = trimmedSearchQuery
    ? {
        title: 'No blocked accounts found',
        subtitle: 'Try a different name or username.',
      }
    : {
        title: 'No blocked accounts',
        subtitle: 'Accounts you block from profiles or messages will appear here.',
      }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Blocked accounts" left={<BackButton onPress={() => router.back()} />} right={null} />
      <View style={styles.searchWrap}>
        <SearchIcon size={15} color={colors.text3} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search blocked accounts"
          placeholderTextColor={colors.text3}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="none"
          autoComplete="off"
          accessibilityLabel="Search blocked accounts"
        />
      </View>

      {error ? <ErrorMessage title="Could not update blocked accounts" message={error} style={styles.error} /> : null}

      {loading ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={filteredAccounts}
          keyExtractor={item => item.blockedUserId}
          renderItem={renderItem}
          contentContainerStyle={filteredAccounts.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}
          ListEmptyComponent={<EmptyState title={empty.title} subtitle={empty.subtitle} />}
          ListFooterComponent={filteredAccounts.length > 0 ? (
            <Text style={styles.footerNote} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              Blocking prevents accounts from following, messaging, or interacting with you. Existing follow relationships are removed when an account is blocked.
            </Text>
          ) : null}
          showsVerticalScrollIndicator={false}
        />
      )}

      {confirmAccount ? (
        <RekkusActionSheet
          visible
          title={`Unblock ${confirmAccount.username ? `@${confirmAccount.username}` : displayName(confirmAccount)}?`}
          subtitle="They'll be able to find you, message you, and interact with you again. Follow relationships won't be restored automatically."
          options={[
            { label: 'Unblock', value: 'unblock', accentColor: colors.accent },
            { label: 'Cancel', value: 'cancel' },
          ]}
          onSelect={value => {
            const account = confirmAccount
            setConfirmAccount(null)
            if (value === 'unblock') void confirmUnblock(account)
          }}
          onDismiss={() => setConfirmAccount(null)}
        />
      ) : null}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    searchWrap: {
      minHeight: AVATAR_SIZE,
      marginHorizontal: spacing[4],
      marginTop: spacing[3],
      marginBottom: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: radius.lg3,
      borderWidth: spacing.hairline,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    searchInput: {
      flex: 1,
      minHeight: AVATAR_SIZE,
      color: c.text,
      fontSize: fontSize.base,
      lineHeight: lineHeight.normal,
      paddingVertical: spacing[0],
    },
    error: { marginHorizontal: spacing[4], marginTop: spacing[2] },
    list: {
      paddingTop: spacing[1],
      paddingBottom: spacing.px40,
    },
    emptyList: {
      flexGrow: 1,
      paddingBottom: spacing.px40,
    },
    skeletonList: {
      paddingTop: spacing[2],
      paddingHorizontal: spacing[4],
      gap: spacing[3],
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: spacing.px60,
      gap: spacing[3],
    },
    skeletonText: {
      flex: 1,
      gap: spacing[2],
    },
    row: {
      minHeight: ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      gap: spacing[3],
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: radius.full,
      overflow: 'hidden',
      backgroundColor: c.surface2,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: radius.full,
    },
    avatarFallback: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    avatarInitial: {
      color: c.text2,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    rowCopy: { flex: 1, minWidth: 0 },
    name: {
      color: c.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
    },
    handle: {
      color: c.text3,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.tight,
      marginTop: spacing.px2,
    },
    meta: {
      color: c.text3,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.tight,
      marginTop: spacing.px2,
    },
    unblockButton: {
      minHeight: AVATAR_SIZE,
      minWidth: UNBLOCK_MIN_WIDTH,
      paddingHorizontal: spacing[3],
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    unblockButtonDisabled: {
      opacity: 0.72,
    },
    unblockLabel: {
      color: c.bg,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.normal,
    },
    footerNote: {
      marginHorizontal: spacing[4],
      marginTop: spacing[4],
      color: c.text3,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.body,
    },
  })
}
