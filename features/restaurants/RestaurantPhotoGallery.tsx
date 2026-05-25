import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CloseIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius, spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

type Props = {
  visible: boolean
  photos: string[]
  initialIndex: number
  onClose: () => void
}

const CLOSE_BTN_SIZE = spacing.px36

function makeStyles(overlay: string) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'black',
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[3],
    },
    closeBtn: {
      width: CLOSE_BTN_SIZE,
      height: CLOSE_BTN_SIZE,
      borderRadius: radius.xl,
      backgroundColor: overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: spacing[4],
      alignItems: 'center',
    },
    counter: {
      color: 'white',
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
  })
}

export function RestaurantPhotoGallery({ visible, photos, initialIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions()
  const { overlay } = useThemeColors()
  const styles = useMemo(() => makeStyles(overlay), [overlay])
  const scrollRef = useRef<ScrollView>(null)
  const [currentIdx, setCurrentIdx] = useState(initialIndex)

  useEffect(() => {
    if (visible) {
      setCurrentIdx(initialIndex)
      const id = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false })
      }, 0)
      return () => clearTimeout(id)
    }
  }, [visible, initialIndex, width])

  if (photos.length === 0) return null

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.backdrop}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width)
            setCurrentIdx(idx)
          }}
          scrollEventThrottle={16}
        >
          {photos.map((url, i) => (
            <View key={i} style={{ width, height }}>
              <CachedImage
                source={{ uri: url }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>

        <SafeAreaView style={StyleSheet.absoluteFill} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.controls} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close photo gallery"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CloseIcon size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.footer} pointerEvents="none">
            <Text style={styles.counter}>
              {currentIdx + 1} / {photos.length}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}
