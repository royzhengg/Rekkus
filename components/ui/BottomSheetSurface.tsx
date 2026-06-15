import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type React from 'react'

type Props = Omit<
  BottomSheetModalProps<unknown>,
  'backdropComponent' | 'backgroundStyle' | 'children' | 'handleIndicatorStyle' | 'onDismiss' | 'snapPoints'
> & {
  children: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
  onDismiss: () => void
  snapPoints?: BottomSheetModalProps<unknown>['snapPoints']
  visible: boolean
}

export function BottomSheetSurface({
  children,
  contentStyle,
  enablePanDownToClose = true,
  onDismiss,
  snapPoints,
  visible,
  ...modalProps
}: Props) {
  const colors = useThemeColors()
  const modalRef = useRef<BottomSheetModal>(null)
  const resolvedSnapPoints = useMemo(() => snapPoints ?? ['40%'], [snapPoints])
  const styles = useMemo(
    () =>
      StyleSheet.create({
        background: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
        },
        handle: {
          backgroundColor: colors.border2,
        },
        content: {
          paddingBottom: spacing[6],
          paddingHorizontal: spacing[4],
        },
      }),
    [colors]
  )
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.36} />
    ),
    []
  )

  useEffect(() => {
    if (visible) {
      modalRef.current?.present()
      return
    }

    modalRef.current?.dismiss()
  }, [visible])

  return (
    <BottomSheetModal
      ref={modalRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      enablePanDownToClose={enablePanDownToClose}
      handleIndicatorStyle={styles.handle}
      onDismiss={onDismiss}
      snapPoints={resolvedSnapPoints}
      {...modalProps}
    >
      <BottomSheetView style={[styles.content, contentStyle]}>{children}</BottomSheetView>
    </BottomSheetModal>
  )
}
