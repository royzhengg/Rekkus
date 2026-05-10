import React, { useMemo } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

type Props = {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, loading, disabled }: Props) {
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={c.bg} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    btn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.45 },
    label: { fontSize: 15, fontWeight: '600', color: c.bg },
  })
}
