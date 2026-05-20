import React, { useMemo } from 'react'
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type Props = TextInputProps & {
  label?: string
  right?: React.ReactNode
  error?: string
}

export function FormInput({ label, right, error, style, ...props }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, !!right && styles.inputWithRight, style]}
          placeholderTextColor={c.text3}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {right && <View style={styles.right}>{right}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: { gap: spacing.px6 },
    label: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: c.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
    },
    input: { flex: 1, fontSize: fontSize.md, color: c.text, paddingHorizontal: spacing.px14, paddingVertical: spacing[3] },
    inputWithRight: { paddingRight: spacing[2] },
    right: { paddingRight: spacing[3] },
    error: { fontSize: fontSize.bodySm, color: c.liked },
  })
}
