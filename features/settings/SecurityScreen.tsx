import { useRouter } from 'expo-router'
import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LockIcon, UserIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useMFA } from '@/lib/hooks/useMFA'
import { BackButton, ControlRow, Divider, SettingsGroup } from './SettingsControlDock'

export default function SecurityScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { mfaEnabled } = useMFA()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Security"
        left={<BackButton onPress={() => router.back()} />}
        right={<View style={styles.headerSpacer} />}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SettingsGroup title="Account protection">
          <ControlRow
            label="Two-Factor Authentication"
            summary={mfaEnabled ? 'Active' : 'Off'}
            sublabel={mfaEnabled ? 'Your account is protected' : 'Add an extra layer of security'}
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/two-factor-auth')}
          />
        </SettingsGroup>

        <SettingsGroup title="Sign-in methods">
          <ControlRow
            label="Connected Accounts"
            sublabel="Manage linked sign-in methods"
            icon={<UserIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/connected-accounts')}
          />
          <Divider />
          <ControlRow
            label="Password"
            summary="Protected"
            sublabel="Update your password"
            icon={<LockIcon size={18} color={colors.text} />}
            onPress={() => router.push('/settings/change-password')}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerSpacer: { width: spacing.px36 },
    scroll: {
      paddingTop: spacing[4],
      paddingBottom: spacing.px40,
    },
  })
}
