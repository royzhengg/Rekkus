import { useEffect, useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight, maxFontSizeMultiplier } from '@/constants/Typography'
import { SPRING_SMOOTH } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

export type RekkusActionSheetOption = {
  label: string
  value: string
  icon?: ReactNode | undefined
  description?: string | undefined
  accentColor?: string | undefined
  variant?: 'row' | 'tile' | undefined
  loading?: boolean | undefined
  selected?: boolean | undefined
  destructive?: boolean | undefined
}

type Props = {
  visible: boolean
  title?: string | undefined
  subtitle?: string | undefined
  header?: ReactNode | undefined
  options: RekkusActionSheetOption[]
  onSelect: (value: string) => void
  onDismiss: () => void
  onAfterDismiss?: () => void
}

const DISMISS_THRESHOLD = 80
const DISMISS_VELOCITY = 800

export function RekkusActionSheet({
  visible,
  title,
  subtitle,
  header,
  options,
  onSelect,
  onDismiss,
  onAfterDismiss,
}: Props) {
  const colors = useThemeColors()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => makeStyles(colors, insets.bottom), [colors, insets.bottom])
  const translateY = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (visible) translateY.value = 0
  }, [visible, translateY])

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd(e => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onDismiss)()
      } else {
        translateY.value = reduceMotion ? 0 : withSpring(0, SPRING_SMOOTH)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onDismiss}
      onDismiss={onAfterDismiss}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss popup"
      />
      <Animated.View style={[styles.sheet, sheetStyle]} accessibilityRole="menu">
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {!!title && <Text style={styles.title} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>{subtitle}</Text>}
        {header}
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.options}
          showsVerticalScrollIndicator={false}
        >
          {options.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                option.variant === 'tile' && styles.optionTile,
                option.selected && styles.optionSelected,
                option.loading && styles.optionDisabled,
              ]}
              onPress={() => {
                if (option.loading) return
                onSelect(option.value)
                onDismiss()
              }}
              activeOpacity={0.82}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: !!option.selected, busy: !!option.loading }}
            >
              <View style={styles.optionContent}>
                {option.icon != null ? (
                  <View
                    style={[
                      styles.optionIconWrap,
                      option.accentColor ? { backgroundColor: `${option.accentColor}18` } : null,
                    ]}
                  >
                    {option.icon}
                  </View>
                ) : null}
                <View style={styles.optionLabelWrap}>
                  <Text
                    style={[
                      styles.optionText,
                      option.selected && styles.optionTextSelected,
                      option.destructive && styles.optionTextDestructive,
                      option.accentColor && !option.selected ? { color: option.accentColor } : null,
                    ]}
                    maxFontSizeMultiplier={maxFontSizeMultiplier.layout}
                  >
                    {option.label}
                  </Text>
                  {!!option.description && (
                    <Text
                      style={[
                        styles.optionDescription,
                        option.selected && styles.optionDescriptionSelected,
                      ]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={maxFontSizeMultiplier.body}
                    >
                      {option.description}
                    </Text>
                  )}
                </View>
              </View>
              {option.loading && <ActivityIndicator size="small" color={option.selected ? colors.bg : colors.text3} />}
              {option.selected && <Text style={styles.check} maxFontSizeMultiplier={maxFontSizeMultiplier.layout}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>, bottomInset: number) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      maxHeight: '72%',
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill2,
      borderTopRightRadius: radius.pill2,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: spacing[4],
      paddingBottom: Math.max(bottomInset, 16) + 12,
    },
    handleArea: {
      alignItems: 'center',
      paddingTop: spacing.px10,
      paddingBottom: spacing.px18,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: radius.xxs,
      backgroundColor: c.surface2,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing[1],
    },
    subtitle: {
      fontSize: fontSize.bodySm,
      color: c.text2,
      textAlign: 'center',
      lineHeight: lineHeight.compact,
      marginBottom: spacing.px14,
    },
    optionsScroll: { maxHeight: 420 },
    options: { gap: spacing[2], paddingTop: spacing.px2 },
    option: {
      minHeight: 56,
      borderRadius: radius.lg2,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: spacing[4],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionTile: {
      minHeight: 72,
      alignItems: 'flex-start',
      paddingVertical: spacing.px13,
    },
    optionDisabled: { opacity: 0.62 },
    optionSelected: {
      backgroundColor: c.text,
      borderColor: c.text,
    },
    optionContent: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
    optionIconWrap: {
      width: 34,
      height: 34,
      borderRadius: radius.md3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface2,
    },
    optionLabelWrap: { flex: 1, gap: spacing.px2 },
    optionText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.medium,
      color: c.text,
    },
    optionDescription: {
      fontSize: fontSize.bodySm,
      lineHeight: lineHeight.tight,
      color: c.text3,
    },
    optionTextSelected: { color: c.bg },
    optionDescriptionSelected: { color: c.bg },
    optionTextDestructive: { color: c.actionDelete },
    check: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: c.bg },
  })
}
