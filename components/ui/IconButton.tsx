import { useMemo, type ReactNode } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type IconButtonSize = 34 | 36 | 40 | 44
type IconButtonVariant = 'surface' | 'ghost' | 'plain'

type Props = {
  children: ReactNode
  onPress: (event: GestureResponderEvent) => void
  accessibilityLabel: string
  size?: IconButtonSize
  variant?: IconButtonVariant
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}

export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  size = 34,
  variant = 'surface',
  style,
  disabled,
}: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const hitInset = Math.ceil(Math.max(0, (44 - size) / 2))
  const hitSlop = { top: hitInset, bottom: hitInset, left: hitInset, right: hitInset }

  return (
    <TouchableOpacity
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'surface' && styles.surface,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    surface: {
      backgroundColor: c.surface,
    },
    ghost: {
      backgroundColor: c.bg,
    },
    disabled: {
      opacity: 0.45,
    },
  })
}
