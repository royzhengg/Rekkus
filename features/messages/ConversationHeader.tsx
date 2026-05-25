import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { ArrowLeft, CloseIcon, DotsIcon, SearchIcon, UsersIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import type { ConversationParticipant } from '@/lib/services/messaging'
import { activeStatusLabel } from './MessageBubble'

interface ConversationHeaderProps {
  conversationId: string
  participant: ConversationParticipant | null
  isGroup: boolean
  headerTitle: string
  headerSubtitle: string | null
  participantPalette: { bg: string; color: string }
  searchMode: boolean
  searchQuery: string
  onSearch: (query: string) => void
  onBack: () => void
  onToggleSearch: () => void
  onOptions: () => void
  colors: ReturnType<typeof useThemeColors>
}

export function ConversationHeader({
  conversationId,
  participant,
  isGroup,
  headerTitle,
  headerSubtitle,
  participantPalette,
  searchMode,
  searchQuery,
  onSearch,
  onBack,
  onToggleSearch,
  onOptions,
  colors,
}: ConversationHeaderProps) {
  const router = useRouter()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft />
      </TouchableOpacity>

      {searchMode ? (
        <>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={onSearch}
            placeholder="Search messages…"
            placeholderTextColor={colors.text3}
            autoFocus
            returnKeyType="search"
          />
          <IconButton
            accessibilityLabel="Close message search"
            onPress={onToggleSearch}
            size={36}
            variant="plain"
          >
            <CloseIcon size={18} color={colors.text3} />
          </IconButton>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={() => router.push(routes.conversationInfo(conversationId))}
          >
            <View style={styles.headerAvatarContainer}>
              {isGroup ? (
                <View style={[styles.headerAvatar, { backgroundColor: colors.surface2 }]}>
                  <UsersIcon size={20} color={colors.text2} />
                </View>
              ) : participant?.avatar_url ? (
                <CachedImage source={{ uri: participant.avatar_url }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: participantPalette.bg }]}>
                  <Text style={[styles.headerAvatarText, { color: participantPalette.color }]}>
                    {(participant?.full_name ?? participant?.username ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {!isGroup && activeStatusLabel(participant?.last_seen_at) === 'Active now' ? (
                <View style={styles.onlineDot} />
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerText}
            onPress={() => router.push(routes.conversationInfo(conversationId))}
          >
            {headerTitle ? (
              <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
            ) : (
              <View style={styles.titleSkeleton} />
            )}
            {headerSubtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
            ) : null}
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <IconButton accessibilityLabel="Search messages" onPress={onToggleSearch} size={36} variant="plain">
              <SearchIcon size={18} color={colors.text2} />
            </IconButton>
            <IconButton accessibilityLabel="Open conversation options" onPress={onOptions} size={36} variant="plain">
              <DotsIcon />
            </IconButton>
          </View>
        </>
      )}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[3],
      gap: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border2,
    },
    backBtn: { width: 36, alignItems: 'flex-start', justifyContent: 'center' },
    headerAvatarBtn: { marginRight: spacing[1] },
    headerAvatarContainer: { position: 'relative' },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: radius.sm,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.bg,
    },
    titleSkeleton: {
      height: 14,
      width: 100,
      borderRadius: radius.sm2,
      backgroundColor: c.surface2,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
    subtitle: { marginTop: spacing.px1, fontSize: fontSize.bodySm, color: c.text3 },
    searchInput: {
      flex: 1,
      height: 36,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.px14,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.md,
    },
  })
}
