import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, CloseIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { radius, spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

type Props = {
  visible: boolean
  photos: string[]
  initialIndex: number
  onClose: () => void
}

type Mode = 'grid' | 'fullscreen'

const CTRL_BTN_SIZE = spacing.px36
const THUMB_GAP = 2
const NUM_COLUMNS = 3

function makeStyles(overlay: string, white: string, black: string, thumbSize: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: black,
    },
    // grid mode
    gridHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[3],
    },
    gridTitle: {
      color: white,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    thumb: {
      width: thumbSize,
      height: thumbSize,
      margin: THUMB_GAP / 2,
    },
    // fullscreen mode
    controls: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      paddingHorizontal: spacing[4],
    },
    ctrlBtn: {
      width: CTRL_BTN_SIZE,
      height: CTRL_BTN_SIZE,
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
      alignItems: 'center',
    },
    counter: {
      color: white,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
  })
}

export function PlacePhotoGallery({ visible, photos, initialIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions()
  const { overlay, white, black } = useThemeColors()
  const reduceMotion = useReducedMotion()
  const thumbSize = (width - THUMB_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS
  const styles = useMemo(() => makeStyles(overlay, white, black, thumbSize), [overlay, white, black, thumbSize])
  const safeInsets = useSafeAreaInsets()
  // initialWindowMetrics is synchronous — prevents first-render overlap when Modal insets haven't propagated yet
  const safeTop = safeInsets.top || initialWindowMetrics?.insets.top || 0
  const safeBottom = safeInsets.bottom || initialWindowMetrics?.insets.bottom || 0
  const scrollRef = useRef<ScrollView>(null)
  const [mode, setMode] = useState<Mode>('grid')
  const [currentIdx, setCurrentIdx] = useState(initialIndex)

  useEffect(() => {
    if (visible) {
      setMode('grid')
      setCurrentIdx(initialIndex)
    }
  }, [visible, initialIndex])

  useEffect(() => {
    if (mode === 'fullscreen') {
      const id = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: currentIdx * width, animated: false })
      }, 0)
      return () => clearTimeout(id)
    }
  }, [mode, currentIdx, width])

  if (photos.length === 0) return null

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={mode === 'fullscreen' ? () => setMode('grid') : onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={black} />
      <View style={styles.backdrop}>
        {mode === 'grid' ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.gridHeader, { paddingTop: safeTop + spacing[3] }]}>
              <Text style={styles.gridTitle}>Photos ({photos.length})</Text>
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close photo gallery"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <CloseIcon size={20} color={white} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={photos}
              keyExtractor={(_, i) => String(i)}
              numColumns={NUM_COLUMNS}
              contentContainerStyle={{ paddingBottom: safeBottom }}
              renderItem={({ item: url, index: i }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setCurrentIdx(i)
                    setMode('fullscreen')
                  }}
                >
                  <CachedImage source={{ uri: url }} style={styles.thumb} contentFit="cover" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <>
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

            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={[styles.controls, { paddingTop: safeTop + spacing[3] }]} pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.ctrlBtn}
                  onPress={() => setMode('grid')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to photo grid"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={20} color={white} />
                </TouchableOpacity>
              </View>

              <View style={[styles.footer, { paddingBottom: safeBottom + spacing[4] }]} pointerEvents="none">
                <Text style={styles.counter}>
                  {currentIdx + 1} / {photos.length}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}
