import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, CheckIcon, CloseIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import { createGroupConversation } from '@/lib/services/messaging'
import { fetchFollowedUsersBasic } from '@/lib/services/users'

type Contact = {
  user_id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

export default function CreateGroupScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [groupName, setGroupName] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [operationError, setOperationError] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setContacts(await fetchFollowedUsersBasic(user.id))
    setLoading(false)
  }, [user])

  useEffect(() => { void loadContacts() }, [loadContacts])

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      c =>
        c.username.toLowerCase().includes(q) ||
        (c.full_name ?? '').toLowerCase().includes(q)
    )
  }, [contacts, searchQuery])

  function toggleSelect(userId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleCreate() {
    const name = groupName.trim()
    if (!name) {
      Alert.alert('Group name required', 'Please enter a name for your group.')
      return
    }
    if (selected.size < 2) {
      Alert.alert('Add members', 'A group needs at least 2 other members.')
      return
    }
    if (!requireOnline()) {
      setOperationError('Reconnect to create a group conversation.')
      return
    }

    setCreating(true)
    setOperationError(null)
    const { conversationId, error } = await createGroupConversation(
      name,
      Array.from(selected)
    )
    setCreating(false)

    if (error || !conversationId) {
      setOperationError(error ?? 'Please try again.')
      return
    }

    router.replace(routes.conversation(conversationId))
  }

  function renderItem({ item }: { item: Contact }) {
    const isSelected = selected.has(item.user_id)
    return (
      <TouchableOpacity style={styles.contactRow} onPress={() => toggleSelect(item.user_id)} activeOpacity={0.7} accessibilityRole="button">
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <CachedImage source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(item.full_name ?? item.username).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isSelected ? (
            <View style={styles.selectedBadge}>
              <CheckIcon size={12} color={colors.white} />
            </View>
          ) : null}
        </View>
        <View style={styles.contactText}>
          <Text style={styles.contactName}>{item.full_name ?? `@${item.username}`}</Text>
          <Text style={styles.contactUsername}>@{item.username}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected ? <CheckIcon size={14} color={colors.bg} /> : null}
        </View>
      </TouchableOpacity>
    )
  }

  const selectedList = contacts.filter(c => selected.has(c.user_id))

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>New group</Text>
        <TouchableOpacity
          style={[styles.createBtn, (selected.size < 2 || !groupName.trim() || creating) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={selected.size < 2 || !groupName.trim() || creating}
          accessibilityRole="button"
        >
          {creating
            ? <ActivityIndicator size="small" color={colors.bg} />
            : <Text style={styles.createLabel}>Create</Text>}
        </TouchableOpacity>
      </View>
      {operationError ? (
        <ErrorMessage title="Could not create group" message={operationError} style={{ marginHorizontal: spacing[4] }} />
      ) : null}

      <View style={styles.groupNameRow}>
        <TextInput
          style={styles.groupNameInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          placeholderTextColor={colors.text3}
          maxLength={100}
          autoFocus
        />
      </View>

      {/* Selected chips */}
      {selectedList.length > 0 ? (
        <View style={styles.chipsRow}>
          {selectedList.map(c => (
            <TouchableOpacity
              key={c.user_id}
              style={styles.chip}
              onPress={() => toggleSelect(c.user_id)}
            >
              <Text style={styles.chipLabel}>{c.full_name ?? c.username}</Text>
              <CloseIcon size={12} color={colors.text3} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts…"
          placeholderTextColor={colors.text3}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={44} height={44} radius={radius.full} />
              <View style={{ flex: 1, gap: spacing[2] }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.user_id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyLabel}>
                {searchQuery ? 'No contacts match your search.' : 'Follow people to add them to a group.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 36, alignItems: 'flex-start' },
    title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.text, textAlign: 'center' },
    createBtn: {
      backgroundColor: c.text,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px7,
      borderRadius: radius.sm3,
      minWidth: 64,
      alignItems: 'center',
    },
    createBtnDisabled: { opacity: 0.4 },
    createLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.bg },

    groupNameRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    groupNameInput: {
      fontSize: fontSize.xl,
      color: c.text,
      paddingVertical: spacing[1],
    },

    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px5,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    chipLabel: { fontSize: fontSize.base, color: c.text },

    searchRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    searchInput: {
      height: 36,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.px14,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: fontSize.md,
    },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
    emptyLabel: { fontSize: fontSize.base, color: c.text3, textAlign: 'center' },

    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      gap: spacing[3],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    avatarContainer: { position: 'relative' },
    avatar: { width: 44, height: 44, borderRadius: radius.pill2 },
    avatarFallback: { backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold, color: c.text3 },
    selectedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 18,
      height: 18,
      borderRadius: radius.sm4,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.bg,
    },
    contactText: { flex: 1 },
    contactName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
    contactUsername: { fontSize: fontSize.bodySm, color: c.text3 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: radius.md3,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: c.text, borderColor: c.text },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] },
  })
}
