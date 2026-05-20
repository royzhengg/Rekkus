import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { EditIcon, PlusIcon } from '@/components/icons'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { listCreatePostDraftSummaries } from '@/lib/services/postDrafts'
import { analytics } from '@/lib/analytics'

type CreateLauncherContextValue = {
  openCreateLauncher: () => void
}

const CreateLauncherContext = createContext<CreateLauncherContextValue>({
  openCreateLauncher: () => {},
})

export function CreateLauncherProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const openBlankCreate = useCallback(() => {
    router.push({
      pathname: '/(tabs)/create',
      params: { intent: 'new', nonce: String(Date.now()) },
    } as any)
  }, [router])

  const openCreateLauncher = useCallback(() => {
    requireAuth(async () => {
      if (!user?.id) return
      setLoading(true)
      analytics.createLauncher(user.id, 'opened')
      try {
        const drafts = await listCreatePostDraftSummaries()
        if (drafts.length === 0) {
          openBlankCreate()
          return
        }
        setVisible(true)
      } catch {
        openBlankCreate()
      } finally {
        setLoading(false)
      }
    })
  }, [openBlankCreate, requireAuth, user?.id])

  const value = useMemo(() => ({ openCreateLauncher }), [openCreateLauncher])

  return (
    <CreateLauncherContext.Provider value={value}>
      {children}
      <RekkusActionSheet
        visible={visible}
        title="Create a post"
        subtitle="Start fresh, or continue from your saved drafts."
        header={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>What would you like to do?</Text>
          </View>
        }
        options={[
          {
            label: 'New post',
            value: 'new',
            description: 'Start with a blank review.',
            variant: 'tile',
            accentColor: colors.accent,
            icon: <PlusIcon size={18} color={colors.accent} />,
            loading,
          },
          {
            label: 'Edit a draft',
            value: 'drafts',
            description: 'Choose from your saved draft posts.',
            variant: 'tile',
            accentColor: colors.info,
            icon: <EditIcon size={18} color={colors.info} />,
            loading,
          },
        ]}
        onDismiss={() => setVisible(false)}
        onSelect={(value) => {
          if (!user?.id) return
          analytics.createLauncher(user.id, value === 'new' ? 'new_post' : 'edit_draft')
          if (value === 'new') openBlankCreate()
          if (value === 'drafts') router.push('/create/drafts')
        }}
      />
    </CreateLauncherContext.Provider>
  )
}

export function useCreateLauncher() {
  return useContext(CreateLauncherContext)
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 13,
      color: c.text2,
      fontWeight: '500',
    },
  })
}
