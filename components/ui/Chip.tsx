import React, { useMemo } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { label as labelType, caption } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type ChipVariant = 'default' | 'active' | 'filter'

type Props = {
  label: string
  onPress?: () => void
  selected?: boolean
  variant?: ChipVariant
  leading?: React.ReactNode
  detail?: string
  disabled?: boolean
  accessibilityLabel?: string
  numberOfLines?: number
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
  detailStyle?: StyleProp<TextStyle>
}

export function Chip({
  label,
  onPress,
  selected = false,
  variant = 'default',
  leading,
  detail,
  disabled = false,
  accessibilityLabel,
  numberOfLines = 1,
  style,
  labelStyle,
  detailStyle,
}: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeStyle =
    selected && (variant === 'active' || variant === 'filter')
      ? styles.chipSelectedStrong
      : selected
        ? styles.chipSelectedSubtle
        : null
  const activeTextStyle =
    selected && (variant === 'active' || variant === 'filter')
      ? styles.labelSelectedStrong
      : selected
        ? styles.labelSelectedSubtle
        : null

  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      activeOpacity={0.75}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.chip,
        !!detail && styles.withDetail,
        variant === 'filter' && styles.filterChip,
        activeStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leading}
      <Text style={[styles.label, activeTextStyle, labelStyle]} numberOfLines={numberOfLines}>
        {label}
      </Text>
      {!!detail && (
        <Text style={[styles.detail, detailStyle]} numberOfLines={1}>
          {detail}
        </Text>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    chip: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[3],
      borderRadius: radius.xl,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    filterChip: {
      backgroundColor: c.bg,
    },
    withDetail: {
      alignItems: 'flex-start',
      gap: spacing[0],
    },
    chipSelectedSubtle: {
      backgroundColor: `${c.accent}14`,
      borderColor: `${c.accent}55`,
    },
    chipSelectedStrong: {
      backgroundColor: c.text,
      borderColor: c.text,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      ...labelType,
      color: c.text2,
    },
    labelSelectedSubtle: {
      color: c.accent,
    },
    labelSelectedStrong: {
      color: c.bg,
    },
    detail: {
      ...caption,
      color: c.text3,
      marginTop: spacing.px1,
    },
  })
}
