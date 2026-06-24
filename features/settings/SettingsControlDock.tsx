import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native'
import Animated from 'react-native-reanimated'
import { ArrowLeft, CheckIcon, ChevronRight } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { IconButton } from '@/components/ui/IconButton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { usePressScale } from '@/lib/hooks/usePressScale'
import type { ProfileInfo } from '@/lib/services/users'

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton onPress={onPress} accessibilityLabel="Go back" variant="plain" size={36}>
      <ArrowLeft />
    </IconButton>
  )
}

export function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <Text style={styles.sectionHeader} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
      {title}
    </Text>
  )
}

export function Divider() {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.divider} />
}

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <>
      <SectionHeader title={title} />
      <View style={styles.groupCard}>{children}</View>
    </>
  )
}

export function ControlRow({
  label,
  summary,
  sublabel,
  icon,
  onPress,
  planned,
}: {
  label: string
  summary: string
  sublabel?: string
  icon?: React.ReactNode
  onPress?: () => void
  planned?: boolean
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const press = usePressScale()
  const content = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {label}
          </Text>
          {planned ? (
            <Text style={styles.plannedPill} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              Planned
            </Text>
          ) : null}
        </View>
        {sublabel ? (
          <Text style={styles.rowSublabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {summary}
        </Text>
        {onPress ? <ChevronRight /> : null}
      </View>
    </>
  )

  if (!onPress) {
    return <View style={[styles.row, styles.rowStatic, planned && styles.rowMuted]}>{content}</View>
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${summary}`}
    >
      <Animated.View style={[styles.rowPressScale, press.animatedStyle]}>{content}</Animated.View>
    </TouchableOpacity>
  )
}

export function SettingsSwitchRow({
  label,
  sublabel,
  value,
  onValueChange,
}: {
  label: string
  sublabel?: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <TouchableOpacity
      style={styles.switchRow}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.82}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <View style={styles.switchCopy}>
        <Text style={styles.rowLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.rowSublabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          onValueChange={onValueChange}
          pointerEvents="none"
          trackColor={{ false: colors.border2, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>
    </TouchableOpacity>
  )
}

export function SettingsRadioRow({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string
  sublabel?: string
  selected: boolean
  onPress: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const press = usePressScale()

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.rowPressScale, press.animatedStyle]}>
        <View style={styles.radioCopy}>
          <Text style={styles.rowLabel} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={styles.rowSublabel} maxFontSizeMultiplier={maxFontSizeMultiplier.body}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <View style={[styles.radioMark, selected && styles.radioMarkSelected]}>
          {selected ? <CheckIcon size={13} color={colors.bg} /> : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

export function ProfileCard({
  profile,
  email,
  visibility,
  onEditProfile,
}: {
  profile: ProfileInfo | null
  email: string
  visibility: string
  onEditProfile: () => void
}) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const displayName = profile?.full_name?.trim() || profile?.username || 'Your profile'
  const username = profile?.username ? `@${profile.username}` : email
  const initial = displayName.trim().charAt(0).toUpperCase() || 'R'

  return (
    <View style={styles.profileCard}>
      <View style={styles.avatarWrap}>
        {profile?.avatar_url ? (
          <CachedImage
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
            accessibilityLabel={`${displayName} profile photo`}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
              {initial}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.profileName} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {displayName}
        </Text>
        <Text style={styles.profileHandle} numberOfLines={1} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          {username}
        </Text>
        <View style={styles.profileMetaRow}>
          <Text style={styles.profileMeta} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            {visibility}
          </Text>
          <Text style={styles.profileMetaDot} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            /
          </Text>
          <Text style={styles.profileMeta} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
            Taste controls
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.profileEditButton}
        onPress={onEditProfile}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <Text style={styles.profileEditText} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>
          Edit
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    groupCard: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      marginHorizontal: spacing[4],
      overflow: 'hidden',
      borderWidth: spacing.hairline,
      borderColor: c.border,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      marginHorizontal: spacing[4],
      marginBottom: spacing[2],
      padding: spacing.px14,
      borderRadius: radius.md3,
      backgroundColor: c.surface,
      borderWidth: spacing.hairline,
      borderColor: c.border,
    },
    avatarWrap: {
      width: spacing.px56,
      height: spacing.px56,
      borderRadius: radius.round27,
      overflow: 'hidden',
      backgroundColor: c.surface2,
    },
    avatar: {
      width: spacing.px56,
      height: spacing.px56,
      borderRadius: radius.round27,
    },
    avatarFallback: {
      width: spacing.px56,
      height: spacing.px56,
      borderRadius: radius.round27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    avatarInitial: {
      color: c.bg,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
    },
    profileCopy: { flex: 1, minWidth: 0 },
    profileName: {
      color: c.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.title,
    },
    profileHandle: {
      marginTop: spacing.px2,
      color: c.text3,
      fontSize: fontSize.base,
      lineHeight: lineHeight.compact,
    },
    profileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.px6,
      marginTop: spacing.px6,
    },
    profileMeta: {
      color: c.text2,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.medium,
    },
    profileMetaDot: {
      color: c.text3,
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.tight,
    },
    profileEditButton: {
      minWidth: spacing.px50,
      minHeight: spacing.px40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: c.text,
      paddingHorizontal: spacing[3],
    },
    profileEditText: {
      color: c.bg,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    sectionHeader: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.text3,
      letterSpacing: letterSpacing.loose,
      textTransform: 'uppercase',
      marginTop: spacing.px22,
      marginBottom: spacing.px6,
      marginHorizontal: spacing[4],
    },
    row: {
      minHeight: spacing.px60,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px11,
      justifyContent: 'center',
    },
    rowPressScale: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: spacing.px40,
    },
    rowStatic: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowMuted: { opacity: 0.76 },
    rowIcon: {
      width: spacing.px34,
      height: spacing.px34,
      borderRadius: radius.lg3,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing[3],
      backgroundColor: c.surface2,
    },
    rowCopy: { flex: 1, minWidth: 0 },
    switchCopy: { flex: 1, minWidth: 0, paddingRight: spacing[3] },
    radioCopy: { flex: 1, minWidth: 0, paddingRight: spacing[3] },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px6,
    },
    rowLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      color: c.text,
      lineHeight: lineHeight.normal,
    },
    rowSublabel: {
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.compact,
      color: c.text3,
      marginTop: spacing.px2,
    },
    rowValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.px6,
      marginLeft: spacing[3],
      maxWidth: '42%',
    },
    rowValue: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.text2,
      textAlign: 'right',
      lineHeight: lineHeight.tight,
    },
    switchRow: {
      minHeight: spacing.px60,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing.px11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    radioMark: {
      width: spacing.px22,
      height: spacing.px22,
      borderRadius: radius.dotLg,
      borderWidth: spacing.hairline,
      borderColor: c.border2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    radioMarkSelected: {
      backgroundColor: c.text,
      borderColor: c.text,
    },
    plannedPill: {
      overflow: 'hidden',
      borderRadius: radius.full,
      paddingHorizontal: spacing.px6,
      paddingVertical: spacing.px2,
      backgroundColor: c.surface2,
      color: c.text3,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
    },
    divider: {
      height: spacing.hairline,
      backgroundColor: c.border,
      marginLeft: spacing.px60,
    },
  })
}
