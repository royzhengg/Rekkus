import React, { useMemo } from 'react'
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

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
    wrap: { gap: 6 },
    label: { fontSize: 13, fontWeight: '500', color: c.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
    },
    input: { flex: 1, fontSize: 14, color: c.text, paddingHorizontal: 14, paddingVertical: 12 },
    inputWithRight: { paddingRight: 8 },
    right: { paddingRight: 12 },
    error: { fontSize: 12, color: c.liked },
  })
}
